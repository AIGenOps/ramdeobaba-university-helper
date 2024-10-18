#!/usr/bin/env python3
"""
RKNEc PYQ Catalog Builder (Refined)
Generates high-precision catalog.json for local and cloud deployment.
"""

import os
import re
import json

ROOT_DIR = "PYQs"
OUTPUT_FILE = "catalog.json"

BRANCH_MAP = {
    "COMPUTER SCIENCE AND ENGG. II, III & IV YEAR": "Computer Science & Engineering",
    "ELECTRONICS AND COMMUNICATION ENGG. II, III & IV YEAR": "Electronics & Communication",
    "MECHANICAL ENGG. II, III & IV YEAR": "Mechanical Engineering",
    "CIVIL ENGG. II, III & IV YEAR": "Civil Engineering",
    "ELECTRONICS ENGG. II, III & IV YEAR": "Electronics Engineering",
    "INFORMATION TECHNOLOGY II, III & IV YEAR": "Information Technology",
    "ELECTRICAL ENGG. II, III & IV YEAR": "Electrical Engineering",
    "INDUSTRIAL ENGG. I, II & III YEAR": "Industrial Engineering",
    "EIECTRONICS DESIGN TECHNOLOGY II, III & IV YEAR": "Electronics Design Technology",
    "ARTIFICIAL INTELLGENCE AND MACHINE LEARNING": "AI & Machine Learning",
    "CYBER SECURITY ENGG": "Cyber Security Engineering",
    "DATA SCIENCE ENGG": "Data Science Engineering",
    "DATA SCIENCE AND ANALYTICS(DSA)": "Data Science & Analytics",
    "ELECTRONICS AND COMPUTER SCIENCE": "Electronics & Computer Science",
    "AI AND APPLICATION": "AI & Applications",
    "AIDS": "AI & Data Science",
    "BIOMEDICAL ELECTRONICS ENGINEERING": "Biomedical Electronics",
    "BIOMEDICAL ENGG": "Biomedical Engineering",
    "CIVIL AND INFRASTRUCTURE ENGINEERING": "Civil & Infrastructure",
    "MECHANICAL AND AUTOMATION": "Mechanical & Automation",
    "MECHANICAL SMART MANUFACTURING": "Smart Manufacturing",
    "FIRST YEAR": "First Year (All Branches)",
    "HONORS , MINORS": "Honors & Minors",
    "MULTI-DISCIPLINARY": "Multi-Disciplinary",
    "ROBOTICS AND ARTIFICIAL INTELLIGENCE(ROBOTICS & AI)": "Robotics & AI"
}

def clean_branch(raw_branch, program):
    if program in ("B. E", "M. TECH"):
        if raw_branch in BRANCH_MAP:
            return BRANCH_MAP[raw_branch]
        b = raw_branch
        b = re.sub(r"\s+(?:I{1,3}|IV)\s+YEAR.*$", "", b, flags=re.I)
        b = re.sub(r"^(?:B\.\s*E\s*|M\.\s*TECH\s*)", "", b, flags=re.I).strip()
        return b.title()
    elif "MBA(INTEGRATED)" in program:
        return "MBA Integrated"
    elif "MBA" in program:
        return "MBA"
    elif "MCA" in program:
        return "MCA"
    elif "BBA" in program:
        return "BBA"
    elif "BCA" in program:
        return "BCA"
    return program

def extract_semester(parts):
    mapping = {
        "first": "Sem 1", "1st": "Sem 1", "sem 1": "Sem 1", "sem-1": "Sem 1",
        "second": "Sem 2", "2nd": "Sem 2", "sem 2": "Sem 2", "sem-2": "Sem 2",
        "third": "Sem 3", "3rd": "Sem 3", "sem 3": "Sem 3", "sem-3": "Sem 3",
        "fourth": "Sem 4", "4th": "Sem 4", "sem 4": "Sem 4", "sem-4": "Sem 4",
        "fifth": "Sem 5", "5th": "Sem 5", "sem 5": "Sem 5", "sem-5": "Sem 5",
        "sixth": "Sem 6", "6th": "Sem 6", "sem 6": "Sem 6", "sem-6": "Sem 6",
        "seventh": "Sem 7", "7th": "Sem 7", "sem 7": "Sem 7", "sem-7": "Sem 7",
        "eighth": "Sem 8", "eigth": "Sem 8", "8th": "Sem 8", "sem 8": "Sem 8", "sem-8": "Sem 8",
    }
    for p in reversed(parts[1:]):
        p_low = p.lower()
        for k, v in mapping.items():
            if k in p_low:
                return v
    for p in parts:
        if "first year" in p.lower():
            return "First Year"
        if "open elective" in p.lower():
            return "Open Elective"
    return "All Semesters"

def parse_session_year(parts):
    session = "Regular"
    year = 0
    # Scan from folder path only (ignoring filename)
    for p in parts[:-1]:
        p_up = p.upper().replace("_", " ").replace("-", " ")
        if "SUMMER" in p_up:
            session = "Summer"
        elif "WINTER" in p_up:
            session = "Winter"

        # 4-digit year 2010 to 2026
        m = re.findall(r"\b(20[12]\d)\b", p_up)
        if m:
            y = int(m[-1])
            if 2010 <= y <= 2026:
                year = y
        else:
            # 2-digit year like 12 to 26
            m2 = re.findall(r"\b(1[0-9]|2[0-6])\b", p_up)
            if m2:
                year = 2000 + int(m2[-1])
    return session, year

def parse_subject_and_code(filename):
    name = os.path.splitext(filename)[0].strip()
    code = ""

    # Check for trailing paper code like -2076 or - 2064
    m_code = re.search(r"[-_\s]+(\d{3,5})$", name)
    if m_code:
        code = m_code.group(1)
        name = name[:m_code.start()].strip()

    # Strip prefixes like A_MCT621_, RW 16, MS 19
    name = re.sub(r"^[A-Z0-9_\-]{3,12}_", "", name)
    name = re.sub(r"^(?:RS|RW|MS|MW)\s*\d{2}\s*", "", name, flags=re.I)
    name = re.sub(r"^[A-Z]_\s*", "", name)
    name = re.sub(r"[-_\s]+", " ", name).strip()
    return name, code

def build_catalog():
    print("Indexing PYQs...")
    items = []
    idx = 0

    for root, dirs, files in os.walk(ROOT_DIR):
        for f in files:
            if not f.lower().endswith(".pdf"):
                continue

            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, ROOT_DIR)
            parts = rel_path.split(os.sep)

            program = parts[0]
            raw_branch = parts[1] if (program in ("B. E", "M. TECH") and len(parts) > 1) else program
            branch = clean_branch(raw_branch, program)

            is_makeup = any("MAKE" in p.upper() for p in parts)
            exam_type = "Make-Up" if is_makeup else "Regular"

            sem = extract_semester(parts)
            session, year = parse_session_year(parts)
            subject, code = parse_subject_and_code(f)
            if not subject:
                subject = os.path.splitext(f)[0]

            size_bytes = os.path.getsize(full_path)
            size_kb = round(size_bytes / 1024, 1)

            idx += 1
            items.append({
                "id": idx,
                "title": subject,
                "code": code,
                "program": program,
                "branch": branch,
                "sem": sem,
                "type": exam_type,
                "session": session,
                "year": year,
                "size_kb": size_kb,
                "path": rel_path
            })

    # Sort descending by year, then program, branch, sem, title
    items.sort(key=lambda x: (
        -x["year"],
        x["program"],
        x["branch"],
        x["sem"],
        x["title"]
    ))

    for i, item in enumerate(items, 1):
        item["id"] = i

    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(items, out, separators=(',', ':'))

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"Catalog complete: {len(items)} items, {size_mb:.2f} MB saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    build_catalog()
