import pytest

import app as app_module


@pytest.fixture
def client():
    app_module.CURRENT['puzzle'] = None
    app_module.CURRENT['solution'] = None
    app_module.app.config['TESTING'] = True

    with app_module.app.test_client() as test_client:
        yield test_client

    app_module.CURRENT['puzzle'] = None
    app_module.CURRENT['solution'] = None


def test_index_route_renders_html(client):
    response = client.get('/')

    assert response.status_code == 200
    assert b'Sudoku Game' in response.data
    assert b'new-game' in response.data


def test_new_game_route_returns_puzzle_and_stores_solution(client):
    response = client.get('/new?clues=35')

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload['puzzle']) == 9
    assert all(len(row) == 9 for row in payload['puzzle'])
    assert app_module.CURRENT['puzzle'] == payload['puzzle']
    assert app_module.CURRENT['solution'] is not None
    assert len(app_module.CURRENT['solution']) == 9


def test_check_solution_accepts_correct_board(client):
    client.get('/new?clues=35')
    solution = app_module.CURRENT['solution']

    response = client.post('/check', json={'board': solution})

    assert response.status_code == 200
    assert response.get_json()['incorrect'] == []


def test_check_solution_rejects_missing_game_and_reports_wrong_cells(client):
    response = client.post('/check', json={'board': [[0 for _ in range(9)] for _ in range(9)]})

    assert response.status_code == 400
    assert response.get_json()['error'] == 'No game in progress'

    client.get('/new?clues=35')
    wrong_board = [row[:] for row in app_module.CURRENT['solution']]
    wrong_board[0][0] = 0

    response = client.post('/check', json={'board': wrong_board})

    assert response.status_code == 200
    incorrect = response.get_json()['incorrect']
    assert [0, 0] in incorrect


def test_new_game_route_accepts_difficulty_and_preserves_backward_compatibility(client):
    # difficulty=easy
    response = client.get('/new?difficulty=easy')
    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload['puzzle']) == 9
    assert sum(cell != 0 for row in payload['puzzle'] for cell in row) == 45

    # difficulty=medium
    response = client.get('/new?difficulty=medium')
    assert response.status_code == 200
    payload = response.get_json()
    assert sum(cell != 0 for row in payload['puzzle'] for cell in row) == 35

    # difficulty=hard
    response = client.get('/new?difficulty=hard')
    assert response.status_code == 200
    payload = response.get_json()
    assert sum(cell != 0 for row in payload['puzzle'] for cell in row) == 28

    # backward compatibility with clues param
    response = client.get('/new?clues=40')
    assert response.status_code == 200
    payload = response.get_json()
    assert sum(cell != 0 for row in payload['puzzle'] for cell in row) == 40

    # invalid difficulty
    response = client.get('/new?difficulty=unknown')
    assert response.status_code == 400
