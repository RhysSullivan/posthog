import uuid

import pytest

from posthog.clickhouse.schema import CREATE_MERGETREE_TABLE_QUERIES, CREATE_TABLE_QUERIES, build_query, get_table_name


@pytest.mark.parametrize("query", CREATE_TABLE_QUERIES, ids=get_table_name)
def test_create_table_query(query, snapshot, settings):
    settings.CLICKHOUSE_REPLICATION = False

    assert build_query(query) == snapshot


@pytest.mark.parametrize("query", CREATE_MERGETREE_TABLE_QUERIES, ids=get_table_name)
def test_create_table_query_replicated_and_storage(query, snapshot, settings):
    settings.CLICKHOUSE_REPLICATION = True
    settings.CLICKHOUSE_ENABLE_STORAGE_POLICY = True

    assert build_query(query) == snapshot


@pytest.fixture(autouse=True)
def mock_uuid4(mocker):
    mock_uuid4 = mocker.patch("uuid.uuid4")
    mock_uuid4.return_value = uuid.UUID("77f1df52-4b43-11e9-910f-b8ca3a9b9f3e")
    yield mock_uuid4
