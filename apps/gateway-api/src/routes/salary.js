// Fastify route for salary calculation with validation
import { z } from 'zod';
import { loadLocalKB } from '../kb/loadLocalKB.js';

const salaryKB = loadLocalKB('salaries');

// Validation schemas
const SalaryCalculateRequest = z.object({
  salary: z.number()
    .positive('Salary must be positive')
    .describe('Base salary amount'),
  
  region: z.enum(['riyadh', 'jeddah', 'dammam', 'other'], { 
    errorMap: () => ({ message: 'Invalid region. Must be riyadh, jeddah, dammam, or other' })
  }),
  
  experience: z.number()
    .int('Experience must be whole years')
    .min(0, 'Experience cannot be negative')
    .max(60, 'Experience cannot exceed 60 years'),
  
  employmentType: z.enum(['full-time', 'part-time', 'contractor'])
    .optional()
    .default('full-time'),
});

const SalaryQuerySchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export default function (fastify, opts, done) {
  // GET specific salary record
  fastify.get('/salary/:id', {
    schema: {
      description: 'Get salary record by ID',
      tags: ['salary'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { id } = SalaryQuerySchema.parse(request.params);
      const row = salaryKB.find(r => String(r.id) === id);
      
      if (!row) {
        return reply.code(404).send({ 
          success: false,
          error: 'Salary record not found' 
        });
      }
      
      return reply.code(200).send({ 
        success: true,
        data: { salary: row.salary, details: row } 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      fastify.log.error(error, 'Get salary failed');
      return reply.code(500).send({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // POST calculate salary with deductions
  fastify.post('/salary/calculate', {
    schema: {
      description: 'Calculate net salary with deductions',
      tags: ['salary'],
      body: {
        type: 'object',
        properties: {
          salary: { type: 'number' },
          region: { type: 'string', enum: ['riyadh', 'jeddah', 'dammam', 'other'] },
          experience: { type: 'number' },
          employmentType: { type: 'string' },
        },
        required: ['salary', 'region', 'experience'],
      },
    },
  }, async (request, reply) => {
    try {
      const validated = SalaryCalculateRequest.parse(request.body);
      const result = calculateSalary(validated);
      
      return reply.code(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'VALIDATION_ERROR',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      
      fastify.log.error(error, 'Salary calculation failed');
      return reply.code(500).send({
        success: false,
        error: 'CALCULATION_FAILED',
        message: 'Unable to calculate salary at this moment',
      });
    }
  });

  // POST estimate benefits
  fastify.post('/salary/estimate-benefits', {
    schema: {
      description: 'Estimate total benefits package',
      tags: ['salary'],
      body: {
        type: 'object',
        properties: {
          salary: { type: 'number' },
          region: { type: 'string' },
        },
        required: ['salary', 'region'],
      },
    },
  }, async (request, reply) => {
    try {
      const validated = SalaryCalculateRequest.partial().parse(request.body);
      
      if (!validated.salary || !validated.region) {
        return reply.code(400).send({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          required: ['salary', 'region'],
        });
      }

      const benefits = estimateBenefits(validated);
      return reply.code(200).send({
        success: true,
        data: benefits,
      });
    } catch (error) {
      fastify.log.error(error, 'Benefits estimation failed');
      return reply.code(500).send({
        success: false,
        error: 'ESTIMATION_FAILED',
      });
    }
  });

  done();
}

// Helper functions
function calculateSalary(params) {
  const { salary, region, experience } = params;

  // Calculate deductions based on Saudi Arabian policy
  const taxPercent = getTaxRate(salary, experience);
  const gosiPercent = 0.105; // 10.5% GOSI contribution

  const tax = salary * taxPercent;
  const gosi = salary * gosiPercent;
  const other = getOtherDeductions(salary, region);

  const totalDeductions = tax + gosi + other;
  const netSalary = Math.max(0, salary - totalDeductions);

  return {
    grossSalary: Math.round(salary * 100) / 100,
    deductions: {
      tax: Math.round(tax * 100) / 100,
      gosi: Math.round(gosi * 100) / 100,
      other: Math.round(other * 100) / 100,
    },
    netSalary: Math.round(netSalary * 100) / 100,
    breakdown: [
      { item: 'Gross Salary', amount: salary },
      { item: 'Income Tax', amount: -tax },
      { item: 'GOSI Contribution', amount: -gosi },
      { item: 'Other Deductions', amount: -other },
      { item: 'Net Salary', amount: netSalary },
    ],
  };
}

function getTaxRate(salary, experience) {
  // Simplified tax rate based on salary bands
  if (salary < 3000) return 0;
  if (salary < 5000) return 0.05;
  if (salary < 10000) return 0.08;
  return 0.1;
}

function getOtherDeductions(salary, region) {
  // Health insurance and regional deductions
  const baseDeduction = salary * 0.02;
  const regionalAdjustment = region === 'riyadh' ? 0.01 : 0;
  return baseDeduction + regionalAdjustment;
}

function estimateBenefits(params) {
  const { salary, experience, region } = params;
  
  return {
    healthInsurance: salary * 0.05,
    pensionContribution: salary * 0.05,
    annualBonus: salary * (experience > 5 ? 2 : 1.5),
    endOfServiceBenefit: salary * (experience / 12),
    transportAllowance: region === 'riyadh' ? 1500 : 1000,
    housingAllowance: salary * 0.15,
  };
}
