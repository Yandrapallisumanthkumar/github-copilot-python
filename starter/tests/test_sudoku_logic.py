import pytest

import sudoku_logic


@pytest.fixture
def sample_board():
    board = sudoku_logic.create_empty_board()
    board[0][0] = 5
    board[0][1] = 1
    board[0][2] = 2
    board[1][0] = 6
    board[1][1] = 7
    board[1][2] = 3
    board[2][0] = 8
    board[2][1] = 9
    board[2][2] = 4
    return board


def test_create_empty_board_returns_9_by_9_zero_grid():
    board = sudoku_logic.create_empty_board()

    assert len(board) == sudoku_logic.SIZE
    assert all(len(row) == sudoku_logic.SIZE for row in board)
    assert all(cell == sudoku_logic.EMPTY for row in board for cell in row)


def test_is_safe_detects_conflict_in_row_column_or_box():
    board = sudoku_logic.create_empty_board()
    board[0][0] = 5
    board[0][1] = 5

    assert sudoku_logic.is_safe(board, 0, 2, 5) is False

    board = sudoku_logic.create_empty_board()
    board[0][0] = 5
    board[1][0] = 5

    assert sudoku_logic.is_safe(board, 2, 0, 5) is False

    board = sudoku_logic.create_empty_board()
    board[0][0] = 5
    board[0][1] = 1
    board[0][2] = 2
    board[1][0] = 3
    board[1][1] = 4
    board[1][2] = 5
    board[2][0] = 6
    board[2][1] = 7
    board[2][2] = 8
    board[0][3] = 5

    assert sudoku_logic.is_safe(board, 0, 3, 5) is False


def test_generate_puzzle_returns_expected_shapes_and_clue_count():
    puzzle, solution = sudoku_logic.generate_puzzle(35)

    assert len(puzzle) == sudoku_logic.SIZE
    assert len(solution) == sudoku_logic.SIZE
    assert all(len(row) == sudoku_logic.SIZE for row in puzzle)
    assert all(len(row) == sudoku_logic.SIZE for row in solution)
    assert sum(cell != sudoku_logic.EMPTY for row in puzzle for cell in row) == 35
    assert sum(cell != sudoku_logic.EMPTY for row in solution for cell in row) == 81

    assert all(0 <= cell <= 9 for row in puzzle for cell in row)
    assert all(1 <= cell <= 9 for row in solution for cell in row)


def test_generate_puzzle_solution_is_a_valid_complete_board():
    puzzle, solution = sudoku_logic.generate_puzzle(35)

    def valid_group(values):
        return sorted(values) == list(range(1, sudoku_logic.SIZE + 1))

    for row in solution:
        assert valid_group(row)

    for col in range(sudoku_logic.SIZE):
        column = [solution[row][col] for row in range(sudoku_logic.SIZE)]
        assert valid_group(column)

    for box_row in range(0, sudoku_logic.SIZE, 3):
        for box_col in range(0, sudoku_logic.SIZE, 3):
            box = [
                solution[r][c]
                for r in range(box_row, box_row + 3)
                for c in range(box_col, box_col + 3)
            ]
            assert valid_group(box)

    assert any(cell == sudoku_logic.EMPTY for row in puzzle for cell in row)
