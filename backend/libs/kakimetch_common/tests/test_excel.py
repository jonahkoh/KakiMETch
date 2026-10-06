from datetime import date

from kakimetch_common.excel import mobility_from_equipment, parse_excel_date


def test_mobility_from_equipment_uses_wheelchair_before_walking_frame():
    assert mobility_from_equipment("Y", "Y") == "wheelchair_user"
    assert mobility_from_equipment("N", "Y") == "walking_frame_user"
    assert mobility_from_equipment("N", "N") == "ambulant"


def test_parse_excel_date_converts_yyyymmdd_values():
    assert parse_excel_date(20260901) == date(2026, 9, 1)
