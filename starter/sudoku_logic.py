import copy
import random

SIZE = 9
EMPTY = 0
FULL_MASK = (1 << SIZE) - 1

# Difficulty configuration: map level name to exact number of prefilled clues
DIFFICULTY_CLUES = {
    'easy': 45,
    'medium': 35,
    'hard': 28,
}


def clues_for_difficulty(level: str) -> int:
    if level is None:
        raise ValueError('Difficulty level is required')
    if not isinstance(level, str):
        raise ValueError('Difficulty level must be a string')
    key = level.lower()
    if key not in DIFFICULTY_CLUES:
        raise ValueError(f'Unknown difficulty: {level}')
    return DIFFICULTY_CLUES[key]


def deep_copy(board):
    return copy.deepcopy(board)


def create_empty_board():
    return [[EMPTY for _ in range(SIZE)] for _ in range(SIZE)]


def is_safe(board, row, col, num):
    if num == EMPTY:
        return True

    for x in range(SIZE):
        if board[row][x] == num or board[x][col] == num:
            return False

    start_row = row - row % 3
    start_col = col - col % 3
    for i in range(3):
        for j in range(3):
            if board[start_row + i][start_col + j] == num:
                return False
    return True


def _candidate_values(board, row, col):
    used = set()
    for value in board[row]:
        if value != EMPTY:
            used.add(value)
    for r in range(SIZE):
        value = board[r][col]
        if value != EMPTY:
            used.add(value)

    start_row = row - row % 3
    start_col = col - col % 3
    for r in range(start_row, start_row + 3):
        for c in range(start_col, start_col + 3):
            value = board[r][c]
            if value != EMPTY:
                used.add(value)

    return [value for value in range(1, SIZE + 1) if value not in used]


def _find_empty_cell(board):
    best_cell = None
    best_candidates = None

    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] != EMPTY:
                continue

            candidates = _candidate_values(board, row, col)
            if not candidates:
                return row, col, []

            if best_candidates is None or len(candidates) < len(best_candidates):
                best_cell = (row, col)
                best_candidates = candidates
                if len(best_candidates) == 1:
                    return best_cell[0], best_cell[1], best_candidates

    if best_cell is None:
        return None, None, []
    return best_cell[0], best_cell[1], best_candidates


def _search(board, limit=1):
    if limit <= 0:
        return limit

    row, col, candidates = _find_empty_cell(board)
    if row is None:
        return 1
    if not candidates:
        return 0

    solutions = 0
    for value in candidates:
        board[row][col] = value
        solutions += _search(board, limit - solutions)
        board[row][col] = EMPTY
        if solutions >= limit:
            return solutions
    return solutions


def count_solutions(board, limit=2):
    working_board = deep_copy(board)

    row_mask = [0] * SIZE
    col_mask = [0] * SIZE
    box_mask = [0] * SIZE

    for row in range(SIZE):
        for col in range(SIZE):
            value = working_board[row][col]
            if value == EMPTY:
                continue
            bit = 1 << (value - 1)
            box_index = (row // 3) * 3 + (col // 3)
            if row_mask[row] & bit or col_mask[col] & bit or box_mask[box_index] & bit:
                return 0
            row_mask[row] |= bit
            col_mask[col] |= bit
            box_mask[box_index] |= bit

    count = 0

    def search():
        nonlocal count
        if count >= limit:
            return

        best_row = -1
        best_col = -1
        best_mask = 0
        best_size = 10

        for row in range(SIZE):
            for col in range(SIZE):
                if working_board[row][col] != EMPTY:
                    continue
                box_index = (row // 3) * 3 + (col // 3)
                mask = FULL_MASK & ~(row_mask[row] | col_mask[col] | box_mask[box_index])
                size = mask.bit_count()
                if size == 0:
                    return
                if size < best_size:
                    best_row = row
                    best_col = col
                    best_mask = mask
                    best_size = size
                    if size == 1:
                        break
            if best_size == 1:
                break

        if best_row == -1:
            count += 1
            return

        while best_mask:
            bit = best_mask & -best_mask
            value = bit.bit_length()
            box_index = (best_row // 3) * 3 + (best_col // 3)
            working_board[best_row][best_col] = value
            row_mask[best_row] |= bit
            col_mask[best_col] |= bit
            box_mask[box_index] |= bit
            search()
            row_mask[best_row] ^= bit
            col_mask[best_col] ^= bit
            box_mask[box_index] ^= bit
            working_board[best_row][best_col] = EMPTY
            best_mask ^= bit
            if count >= limit:
                return

    search()
    return count


def _generate_full_solution():
    board = create_empty_board()
    row, col, candidates = _find_empty_cell(board)
    if row is None:
        return board

    def backtrack():
        row, col, candidates = _find_empty_cell(board)
        if row is None:
            return True

        for value in random.sample(candidates, len(candidates)):
            board[row][col] = value
            if backtrack():
                return True
            board[row][col] = EMPTY
        return False

    if not backtrack():
        raise ValueError('Failed to generate a valid Sudoku solution')
    return board


def _remove_cells_for_unique_solution(board, target_clues):
    # Try multiple randomized removal orders to reach exactly target_clues
    max_attempts = 8
    original = deep_copy(board)
    for attempt in range(max_attempts):
        working = deep_copy(original)
        remaining_clues = sum(cell != EMPTY for row in working for cell in row)
        positions = [(row, col) for row in range(SIZE) for col in range(SIZE)]
        random.shuffle(positions)

        for row, col in positions:
            if remaining_clues <= target_clues:
                break
            if working[row][col] == EMPTY:
                continue

            removed = working[row][col]
            working[row][col] = EMPTY
            if count_solutions(working, limit=2) != 1:
                working[row][col] = removed
                continue
            remaining_clues -= 1

        if remaining_clues == target_clues:
            return working

    # If we couldn't reach exact target within attempts, raise an error
    raise ValueError(f'Unable to generate puzzle with exactly {target_clues} clues')


def generate_puzzle(clues=35):
    solution = _generate_full_solution()
    puzzle = deep_copy(solution)
    puzzle = _remove_cells_for_unique_solution(puzzle, clues)
    return puzzle, solution
