module.exports = {
  test: {
    include: ['src/**/?(*.)+(test|spec).?(c|m)[jt]s?(x)'],
    environment: 'node',
    globals: false,
  },
};
