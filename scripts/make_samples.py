from datetime import date
from pathlib import Path
from openpyxl import Workbook

root = Path(__file__).resolve().parents[1]
book = Workbook()
sheet = book.active
sheet.title = 'Faculty Reports'
sheet.append(['Topic', 'Section', 'Execution Date', 'Faculty Name', 'Subject', 'Dept', 'Completion Status', 'Start Time', 'End Time', 'Notes'])
rows = [
    ('Finished linked lists', 'Data Structures', 'COMPLETED'),
    ('Completed LL implementation', 'Data Structures', 'COMPLETED'),
    ('Covered doubly linked list', 'Data Structures', 'IN_PROGRESS'),
    ('Did SQL practice', None, None),
    ('Completed normalization exercise', 'DBMS', 'COMPLETED'),
    ('Demonstrated SQL joins', 'DBMS', 'IN_PROGRESS'),
    ('Explained insertion and deletion in singly linked lists', 'Data Structures', 'IN_PROGRESS'),
    ('Conducted placement aptitude training', None, 'COMPLETED'),
    ('Completed process scheduling', 'Operating Systems', 'COMPLETED'),
    ('Practiced subnetting', 'Computer Networks', 'IN_PROGRESS'),
    ('Introduced linear regression', 'Machine Learning', 'IN_PROGRESS'),
    ('Database lab transactions', 'DBMS', 'COMPLETED'),
    ('Singly & Doubly Linked List Implementation', 'Data Structures', 'COMPLETED'),
    ('Singly & Doubly Linked List Implementation', 'Data Structures', 'COMPLETED'),
    ('Completely unrelated placement training', None, None),
]
for i, (topic, course, status) in enumerate(rows):
    sheet.append([topic, 'CSE-C', date(2026,8,25 + i % 3), 'CSE Faculty', course, 'CSE' if course else None, status, '09:00:00', '10:00:00', 'Synthetic demonstration row'])
sheet.append(['Invalid date example', 'CSE-C', 'no date', None, None, None, None, None, None, 'Expected row validation error'])
sheet.append(list(next(sheet.iter_rows(min_row=2,max_row=2,values_only=True))))
sheet.append([None] * 10)
for column in sheet.columns:
    sheet.column_dimensions[column[0].column_letter].width = 24
path = root / 'data/samples/sample_faculty_reports.xlsx'
path.parent.mkdir(parents=True, exist_ok=True)
book.save(path)
print(path)
