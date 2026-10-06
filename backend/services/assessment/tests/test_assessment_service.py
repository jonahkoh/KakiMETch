from datetime import date

from app.services.assessment_service import assess_client

VALID_CLIENT = {
    "aic_mobility_status": "wheelchair_user",
    "lh_mobility_status": "wheelchair_user",
    "nmts_effective_date": date(2026, 1, 1),
    "nmts_expired_date": date(2026, 12, 31),
    "lh_service_agreement": "Y",
    "sw_service_agreement": "Pending",
}


def test_assessment_accepts_an_eligible_client():
    result = assess_client(
        VALID_CLIENT,
        destination="Jurong East Street 31, Singapore",
        assessment_date=date(2026, 9, 1),
    )

    assert result.decision == "accepted"
    assert result.reasons == []
    assert result.warnings == []


def test_assessment_rejects_an_expired_nmts_window():
    client = {**VALID_CLIENT, "nmts_expired_date": date(2026, 8, 31)}

    result = assess_client(
        client,
        destination="Jurong East Street 31, Singapore",
        assessment_date=date(2026, 9, 1),
    )

    assert result.decision == "rejected"
    assert "NMTS certification is not currently valid." in result.reasons


def test_assessment_warns_when_aic_and_lh_mobility_differ():
    client = {**VALID_CLIENT, "lh_mobility_status": "ambulant"}

    result = assess_client(
        client,
        destination="Jurong East Street 31, Singapore",
        assessment_date=date(2026, 9, 1),
    )

    assert result.decision == "accepted"
    assert result.warnings == ["AIC and LH mobility assessments differ."]


def test_assessment_requires_both_service_agreements():
    client = {**VALID_CLIENT, "sw_service_agreement": "N"}

    result = assess_client(
        client,
        destination="Jurong East Street 31, Singapore",
        assessment_date=date(2026, 9, 1),
    )

    assert result.decision == "rejected"
    assert "A valid SW Service Agreement is required." in result.reasons
