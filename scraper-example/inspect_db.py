import pandas as pd
from sqlalchemy import create_engine

# Use the exact same connection string from your models
engine = create_engine("sqlite:///policy_monitor.db")

def export_database_to_excel(output_filename="medical_policy_export.xlsx"):
    # 1. Query Raw Policies
    policies_df = pd.read_sql("SELECT * FROM policy", engine)
    
    # 2. Query Mapped Criteria (Joins Policy -> PolicyCriterion)
    criteria_query = """
    SELECT 
        p.policy_number, 
        p.title, 
        c.text AS criterion_text, 
        c.concept_words, 
        c.needs_update
    FROM policy p
    JOIN policy_criterion c ON p.policy_number = c.policy_number
    """
    criteria_df = pd.read_sql(criteria_query, engine)
    
    # 3. Query Mapped Codes (Joins Policy -> policy_codes -> Code)
    codes_query = """
    SELECT 
        p.policy_number, 
        cd.system, 
        cd.value AS code_value
    FROM policy p
    JOIN policy_codes pcd ON p.policy_number = pcd.policy_number
    JOIN code cd ON pcd.code_id = cd.code_id
    ORDER BY cd.system, cd.value
    """
    codes_df = pd.read_sql(codes_query, engine)

    # 4. Write dataframes to separate sheets in a single Excel workbook
    with pd.ExcelWriter(output_filename, engine="openpyxl") as writer:
        policies_df.to_excel(writer, sheet_name="Policies", index=False)
        criteria_df.to_excel(writer, sheet_name="Mapped_Criteria", index=False)
        codes_df.to_excel(writer, sheet_name="Mapped_Codes", index=False)
        
    print(f"Data successfully joined and exported to {output_filename}")

if __name__ == "__main__":
    export_database_to_excel()