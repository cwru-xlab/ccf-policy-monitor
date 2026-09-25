"""Export every database table to a separate worksheet, without joins or sampling."""

import re

from openpyxl import Workbook
from sqlalchemy import inspect

from models import get_engine


engine = get_engine()


def _sheet_name(table_name, used_names):
    # Excel limits names to 31 characters and forbids these characters.
    base = re.sub(r"[\\/*?:\[\]]", "_", table_name).strip("'") or "Table"
    name = base[:31]
    suffix = 1
    while name.lower() in used_names:
        tail = f"_{suffix}"
        name = base[:31 - len(tail)] + tail
        suffix += 1
    used_names.add(name.lower())
    return name


def export_database_to_excel(output_filename="medical_policy_export.xlsx"):
    """Export all columns and rows of every table in the default database schema."""
    workbook = Workbook()
    workbook.remove(workbook.active)
    used_names = set()

    with engine.connect() as connection:
        table_names = inspect(connection).get_table_names()
        if not table_names:
            raise ValueError("The database contains no tables to export.")

        for table_name in sorted(table_names):
            quoted_name = connection.dialect.identifier_preparer.quote_identifier(table_name)
            result = connection.exec_driver_sql(f"SELECT * FROM {quoted_name}")
            sheet = workbook.create_sheet(_sheet_name(table_name, used_names))
            sheet.append(list(result.keys()))
            for row in result:
                if any(isinstance(value, str) and len(value) > 32767 for value in row):
                    raise ValueError(
                        f"Table {table_name!r} contains text exceeding Excel's "
                        "32,767-character cell limit; export would truncate data."
                    )
                sheet.append(list(row))

            # Stored text must remain literal text, even when it begins with '='.
            for row in sheet:
                for cell in row:
                    if isinstance(cell.value, str):
                        cell.data_type = "s"
            sheet.freeze_panes = "A2"
            sheet.auto_filter.ref = sheet.dimensions

    workbook.save(output_filename)
    print(f"Exported {len(table_names)} tables to {output_filename}")


if __name__ == "__main__":
    export_database_to_excel()
