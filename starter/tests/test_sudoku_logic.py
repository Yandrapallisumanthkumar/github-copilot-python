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


def _valid_completed_board(board):
    for row in board:
        if sorted(row) != list(range(1, sudoku_logic.SIZE + 1)):
            return False

    for col in range(sudoku_logic.SIZE):
        column = [board[row][col] for row in range(sudoku_logic.SIZE)]
        if sorted(column) != list(range(1, sudoku_logic.SIZE + 1)):
            return False

    for box_row in range(0, sudoku_logic.SIZE, 3):
        for box_col in range(0, sudoku_logic.SIZE, 3):
            box = [
                board[r][c]
                for r in range(box_row, box_row + 3)
                for c in range(box_col, box_col + 3)
            ]
            if sorted(box) != list(range(1, sudoku_logic.SIZE + 1)):
                return False

    return True


def test_count_solutions_distinguishes_zero_one_and_multiple_solutions():
    multi_solution_board = sudoku_logic.create_empty_board()
    multi_solution_board[0][0] = 1
    multi_solution_board[0][1] = 2
    multi_solution_board[1][0] = 3
    assert sudoku_logic.count_solutions(multi_solution_board, limit=2) == 2

    one_solution_board = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ]
    assert sudoku_logic.count_solutions(one_solution_board, limit=2) == 1

    invalid_board = sudoku_logic.create_empty_board()
    invalid_board[0][0] = 1
    invalid_board[0][1] = 1
    assert sudoku_logic.count_solutions(invalid_board, limit=2) == 0


def test_generated_puzzles_have_exactly_one_solution():
    for _ in range(5):
        puzzle, solution = sudoku_logic.generate_puzzle(35)

        assert isinstance(puzzle, list)
        assert isinstance(solution, list)
        assert sudoku_logic.count_solutions(puzzle, limit=2) == 1
        assert _valid_completed_board(solution)


def test_unique_solution_is_preserved_after_cell_removal():
    solved = [
        [5, 3, 4, 6, 7, 8, 9, 1, 2],
        [6, 7, 2, 1, 9, 5, 3, 4, 8],
        [1, 9, 8, 3, 4, 2, 5, 6, 7],
        [8, 5, 9, 7, 6, 1, 4, 2, 3],
        [4, 2, 6, 8, 5, 3, 7, 9, 1],
        [7, 1, 3, 9, 2, 4, 8, 5, 6],
        [9, 6, 1, 5, 3, 7, 2, 8, 4],
        [2, 8, 7, 4, 1, 9, 6, 3, 5],
        [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ]

    puzzle = [row[:] for row in solved]
    puzzle[0][0] = 0
    puzzle[0][1] = 0
    puzzle[4][4] = 0

    assert sudoku_logic.count_solutions(puzzle, limit=2) == 1

    puzzle[0][0] = 0
    puzzle[0][1] = 0
    puzzle[0][2] = 0
    puzzle[1][0] = 0
    puzzle[2][8] = 0
    assert sudoku_logic.count_solutions(puzzle, limit=2) == 1


def test_multiple_generated_puzzles_remain_unique():
    for _ in range(10):
        puzzle, _ = sudoku_logic.generate_puzzle(30)
        assert sudoku_logic.count_solutions(puzzle, limit=2) == 1
