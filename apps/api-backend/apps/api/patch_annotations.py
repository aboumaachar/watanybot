#!/usr/bin/env python3
"""Patch app.py to add MCP ToolAnnotations (readOnlyHint=True, destructiveHint=False, openWorldHint=False)"""
import re, sys, shutil, datetime

target = "app.py"
shutil.copy2(target, f"{target}.bak.{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}")

with open(target, "r", encoding="utf-8") as f:
    code = f.read()

# 1) Add ToolAnnotations import if missing
if "ToolAnnotations" not in code:
    code = code.replace(
        "from mcp.server.fastmcp import FastMCP",
        "from mcp.server.fastmcp import FastMCP\nfrom mcp.types import ToolAnnotations",
    )

# 2) Annotate each @mcp.tool()
SAFE_ANNOT = "annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)"

# Replace bare @mcp.tool() before each function def
for fname in ["kb_search", "salary_lookup", "law_search", "healthcheck"]:
    old = f"@mcp.tool()\ndef {fname}"
    new = f"@mcp.tool({SAFE_ANNOT})\ndef {fname}"
    if old in code:
        code = code.replace(old, new)
        print(f"  Patched: {fname}")
    else:
        print(f"  Skipped (already patched or not found): {fname}")

with open(target, "w", encoding="utf-8") as f:
    f.write(code)

print("DONE — app.py patched with ToolAnnotations")
