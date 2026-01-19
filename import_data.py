#!/usr/bin/env python3
"""
Script to import Excel data into the database (PostgreSQL version).
Usage: python3 import_data.py <excel_file> <database_url>
"""

import sys
import os
from pathlib import Path
import openpyxl
import psycopg2
from urllib.parse import urlparse

def import_excel_data(excel_file, db_url):
    """Import Excel data into the database."""
    
    # Load Excel file
    print(f"Loading Excel file: {excel_file}")
    wb = openpyxl.load_workbook(excel_file)
    ws = wb.active
    
    # Extract headers and data
    headers = []
    data = []
    
    for row_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
        if row_idx == 1:
            headers = [h for h in row if h is not None]
        else:
            if row[0] is not None:  # Only include rows with a name
                row_dict = {}
                for col_idx, header in enumerate(headers):
                    row_dict[header] = row[col_idx] if col_idx < len(row) else None
                data.append(row_dict)
    
    print(f"Found {len(data)} athletes")
    
    # Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Insert athletes
    inserted = 0
    for row in data:
        name = row.get('Name', '').strip()
        if not name:
            continue
        
        try:
            body_weight = float(row.get('Bw')) if row.get('Bw') else None
            squat = float(row.get('Squat')) if row.get('Squat') else None
            bench = float(row.get('Bench')) if row.get('Bench') else None
            deadlift = float(row.get('Deadlift')) if row.get('Deadlift') else None
            
            # Calculate total
            total = None
            if squat and bench and deadlift:
                total = squat + bench + deadlift
            
            ohp = float(row.get('OHP')) if row.get('OHP') else None
            incline_bench = float(row.get('Incline Bench')) if row.get('Incline Bench') else None
            rdl = float(row.get('RDL')) if row.get('RDL') else None
            rev_band_bench = float(row.get('Rev Band Bench')) if row.get('Rev Band Bench') else None
            rev_band_squat = float(row.get('Rev Band Squat')) if row.get('Rev Band Squat') else None
            rev_band_dl = float(row.get('Rev Band DL')) if row.get('Rev Band DL') else None
            slingshot_bench = float(row.get('Slingshot Bench')) if row.get('Slingshot Bench') else None
            
            sql = """
            INSERT INTO athletes (name, "bodyWeight", squat, bench, deadlift, total, ohp, 
                                 "inclineBench", rdl, "revBandBench", "revBandSquat", "revBandDl", "slingshotBench", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET
            "bodyWeight" = EXCLUDED."bodyWeight",
            squat = EXCLUDED.squat,
            bench = EXCLUDED.bench,
            deadlift = EXCLUDED.deadlift,
            total = EXCLUDED.total,
            ohp = EXCLUDED.ohp,
            "inclineBench" = EXCLUDED."inclineBench",
            rdl = EXCLUDED.rdl,
            "revBandBench" = EXCLUDED."revBandBench",
            "revBandSquat" = EXCLUDED."revBandSquat",
            "revBandDl" = EXCLUDED."revBandDl",
            "slingshotBench" = EXCLUDED."slingshotBench",
            "updatedAt" = NOW()
            """
            
            cursor.execute(sql, (
                name, body_weight, squat, bench, deadlift, total, ohp,
                incline_bench, rdl, rev_band_bench, rev_band_squat, rev_band_dl, slingshot_bench
            ))
            
            print(f"✓ Imported: {name}")
            inserted += 1
            
        except Exception as e:
            print(f"✗ Failed to import {name}: {str(e)}")
            conn.rollback()
            cursor = conn.cursor()
            continue
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n✓ Import complete! {inserted} athletes imported.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 import_data.py <excel_file> [database_url]")
        sys.exit(1)
        
    excel_file = sys.argv[1]
    db_url = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("DATABASE_URL")
    
    if not db_url:
        print("Error: DATABASE_URL not provided")
        sys.exit(1)
    
    if not Path(excel_file).exists():
        print(f"Error: Excel file not found: {excel_file}")
        sys.exit(1)
    
    import_excel_data(excel_file, db_url)
