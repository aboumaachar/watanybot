"""Show one row per rank with key columns."""
import csv

with open(r"c:\xampp\htdocs\projectx\watanybot\sources\primary\salaries\salary_full.csv", encoding="utf-8") as f:
    reader = list(csv.DictReader(f))

seen = set()
headers = list(reader[0].keys())
print("Headers:", headers)
print()

for r in reader:
    key = r["Rank"]
    if key not in seen:
        seen.add(key)
        vals = {
            "Cat": r["Category"],
            "Rank": r["Rank"],
            "D(BasicSalary)": r["BasicSalary"],
            "F(vetsalary)": r.get("vetsalary ", r.get("vetsalary", "?")),
            "P(2026)": r["2026"],
            "Q(2026$)": r["2026 $"],
            "T(6salary)": r["6 salary"],
            "U(total2026)": r["total salary 2026"],
        }
        print(" | ".join(f"{k}={v}" for k, v in vals.items()))
