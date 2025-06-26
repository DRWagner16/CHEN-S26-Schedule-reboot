# In convert_excel.py

import pandas as pd
import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import os
import sys # Import sys to allow the script to exit with an error code

# This function remains the same
def calculate_duration(time_str):
    if pd.isna(time_str) or time_str == "TBA" or '-' not in str(time_str):
        return None
    try:
        time_str = str(time_str).replace("AM", " AM").replace("PM", " PM")
        start_time_str, end_time_str = time_str.split('-')
        time_format = "%I:%M %p"
        start_time = datetime.strptime(start_time_str.strip(), time_format)
        end_time = datetime.strptime(end_time_str.strip(), time_format)
        duration = (end_time - start_time).total_seconds() / 60
        return int(duration)
    except (ValueError, AttributeError):
        return None

# This function has been updated with more logging and stricter error handling
def convert_gsheet_to_json():
    """
    Reads data from a Google Sheet, processes it, and saves it to a JSON file.
    """
    ########## UPDATE THESE VALUES FOR YOUR SETUP ##########
    google_sheet_name = 'Teaching Assignments 2025-2026' 
    worksheet_name = 'Spring Summary' 
    output_json_file = 'S26schedule.json'
    ########################################################
    
    try:
        print("[INFO] Authenticating with Google Sheets API...")
        google_creds_json = os.environ['GCP_SA_KEY']
        google_creds_dict = json.loads(google_creds_json)
        
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = ServiceAccountCredentials.from_json_keyfile_dict(google_creds_dict, scope)
        client = gspread.authorize(creds)
        
        print(f"[INFO] Reading data from Google Sheet: '{google_sheet_name}' (Worksheet: '{worksheet_name}')...")
        sheet = client.open(google_sheet_name).worksheet(worksheet_name)
        data = sheet.get_all_records()
        df = pd.DataFrame(data)

        # --- NEW: Debugging step to see what data was actually loaded ---
        print(f"[DEBUG] Successfully loaded {len(df.index)} rows. First 5 rows of data:")
        print(df.head().to_string())
        # --- END DEBUG ---

        print("[INFO] Setting course number...")
        df['course_number'] = df['COURSE'].astype(str)

        print("[INFO] Calculating class durations...")
        df['duration'] = df['TIME'].apply(calculate_duration)
        
        print("[INFO] Identifying and cleaning up unscheduled courses...")
        unscheduled_mask = df['duration'].isnull()
        df.loc[unscheduled_mask, 'TIME'] = 'Online/Asynchronous'
        df.loc[unscheduled_mask, 'DAYS'] = ''

        df = df.rename(columns={
            'INSTRUCTOR': 'instructors', 'DAYS': 'days', 'TIME': 'time_of_day',
            'LOCATION': 'location', 'TYPE': 'type', 'NOTES': 'notes',
            'ENROLL': 'anticipated_enrollment'
        })
        
        final_columns = [
            'course_number', 'instructors', 'days', 'time_of_day', 'duration', 
            'location', 'type', 'notes', 'anticipated_enrollment'
        ]
        for col in final_columns:
            if col not in df.columns:
                df[col] = ''
        df_final = df[final_columns]
        
        df_final = df_final.fillna({
            'instructors': 'TBD', 'days': '', 'time_of_day': 'TBD',
            'location': 'TBD', 'type': 'N/A', 'notes': '',
            'anticipated_enrollment': 0, 'duration': 0
        })

        schedule_data = df_final.to_dict(orient='records')
        
        with open(output_json_file, 'w') as f:
            json.dump(schedule_data, f, indent=4)
            
        print(f"\n[SUCCESS] Conversion complete! Data saved to '{output_json_file}'.")

    except Exception as e:
        # --- MODIFIED: Stricter error handling ---
        print(f"[FATAL] An unexpected error occurred: {e}")
        # Exit with a non-zero code to make the GitHub Action fail correctly
        sys.exit(1)


if __name__ == "__main__":
    convert_gsheet_to_json()
