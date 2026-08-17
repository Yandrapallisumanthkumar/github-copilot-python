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
    # ensure timer element is present in the served HTML
    assert b'id="timer"' in response.data
    # ensure scoreboard container is present for client-side rendering
    assert b'id="scoreboard"' in response.data
    # ensure theme toggle is present
    assert b'id="theme-toggle"' in response.data


def test_index_has_difficulty_selector(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'id="difficulty-select"' in response.data
    assert b'>Easy<' in response.data
    assert b'>Medium<' in response.data
    assert b'>Hard<' in response.data


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


def test_hint_requires_game_and_fills_cell(client):
    # no game in progress
    response = client.post('/hint')
    assert response.status_code == 400
    assert response.get_json()['error'] == 'No game in progress'
    # GET should return a JSON error (not HTML 404)
    gresp = client.get('/hint')
    assert gresp.status_code == 405
    assert 'application/json' in gresp.headers.get('Content-Type', '')
    assert gresp.get_json()['error'] == 'Use POST to request a hint'

    # start a new game
    client.get('/new?clues=35')
    before = [row[:] for row in app_module.CURRENT['puzzle']]
    sol = app_module.CURRENT['solution']

    resp = client.post('/hint')
    assert resp.status_code == 200
    payload = resp.get_json()
    # Ensure server returns JSON content type
    assert 'application/json' in resp.headers.get('Content-Type', '')
    assert 'row' in payload and 'col' in payload and 'value' in payload
    r = payload['row']; c = payload['col']; v = payload['value']
    # the cell was empty before and the server returned the correct solution value
    assert before[r][c] == 0
    assert sol[r][c] == v
    # server should not modify CURRENT['puzzle'] (client applies hint locally)
    assert app_module.CURRENT['puzzle'][r][c] == before[r][c]


def test_hint_on_completed_puzzle_returns_error(client):
    # set puzzle to solution (no empty cells)
    client.get('/new?clues=35')
    app_module.CURRENT['puzzle'] = [row[:] for row in app_module.CURRENT['solution']]

    resp = client.post('/hint')
    assert resp.status_code == 400
    assert resp.get_json()['error'] == 'No empty cells'
    assert 'application/json' in resp.headers.get('Content-Type', '')


def test_hint_with_selected_cell_returns_correct_value(client):
    client.get('/new?clues=35')
    puzzle = app_module.CURRENT['puzzle']
    sol = app_module.CURRENT['solution']
    # find an empty cell
    found = False
    for i in range(9):
        for j in range(9):
            if puzzle[i][j] == 0:
                found = True
                r, c = i, j
                break
        if found: break
    assert found, 'Test requires at least one empty cell'

    resp = client.post('/hint', json={'row': r, 'col': c})
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload['row'] == r and payload['col'] == c
    assert payload['value'] == sol[r][c]
    # server must not mutate CURRENT['puzzle']
    assert app_module.CURRENT['puzzle'][r][c] == 0


def test_hint_rejects_non_empty_cell_selection(client):
    client.get('/new?clues=35')
    puzzle = app_module.CURRENT['puzzle']
    # find a non-empty (prefilled) cell
    found = False
    for i in range(9):
        for j in range(9):
            if puzzle[i][j] != 0:
                found = True
                r, c = i, j
                break
        if found: break
    assert found, 'Test requires at least one prefilled cell'

    resp = client.post('/hint', json={'row': r, 'col': c})
    assert resp.status_code == 400
    assert resp.get_json()['error'] == 'Selected cell is not empty'


def test_hint_rejects_invalid_coordinates(client):
    client.get('/new?clues=35')
    resp = client.post('/hint', json={'row': 9, 'col': 0})
    assert resp.status_code == 400
    assert resp.get_json()['error'] == 'Invalid coordinates'

    resp2 = client.post('/hint', json={'row': -1, 'col': 0})
    assert resp2.status_code == 400
    assert resp2.get_json()['error'] == 'Invalid coordinates'
