from datetime import date, datetime


def parse_excel_date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        try:
            return datetime.strptime(str(int(value)), "%Y%m%d").date()
        except ValueError:
            return None
    return None


def mobility_from_equipment(wheelchair: object, walking_frame: object) -> str:
    """Derive the initial imported mobility value from the available source fields."""
    if is_yes(wheelchair):
        return "wheelchair_user"
    if is_yes(walking_frame):
        return "walking_frame_user"
    return "ambulant"


def is_yes(value: object) -> bool:
    return as_text(value).upper() == "Y"


def as_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()
