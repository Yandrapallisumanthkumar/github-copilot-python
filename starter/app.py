from flask import Flask, render_template, jsonify, request
import sudoku_logic

app = Flask(__name__)

# Keep a simple in-memory store for current puzzle and solution
CURRENT = {
    'puzzle': None,
    'solution': None
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/new')
def new_game():
    difficulty = request.args.get('difficulty')
    if difficulty:
        try:
            clues = sudoku_logic.clues_for_difficulty(difficulty)
        except ValueError:
            return jsonify({'error': 'Invalid difficulty'}), 400
    else:
        clues = int(request.args.get('clues', 35))

    try:
        puzzle, solution = sudoku_logic.generate_puzzle(clues)
    except ValueError as e:
        return jsonify({'error': str(e)}), 500
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution
    return jsonify({'puzzle': puzzle})

@app.route('/check', methods=['POST'])
def check_solution():
    data = request.json
    board = data.get('board')
    solution = CURRENT.get('solution')
    if solution is None:
        return jsonify({'error': 'No game in progress'}), 400
    incorrect = []
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            if board[i][j] != solution[i][j]:
                incorrect.append([i, j])
    return jsonify({'incorrect': incorrect})


@app.route('/hint', methods=['GET', 'POST'])
@app.route('/hint/', methods=['GET', 'POST'])
def hint():
    app.logger.debug('Received /hint request method=%s', request.method)
    # Support GET with a helpful JSON response to avoid HTML 404 pages
    if request.method == 'GET':
        return jsonify({'error': 'Use POST to request a hint'}), 405
    try:
        solution = CURRENT.get('solution')
        puzzle = CURRENT.get('puzzle')
        if solution is None or puzzle is None:
            return jsonify({'error': 'No game in progress'}), 400

        # If client provided coordinates, use them (selected-cell hint)
        data = request.get_json(silent=True) or {}
        if 'row' in data or 'col' in data:
            try:
                row = int(data.get('row'))
                col = int(data.get('col'))
            except Exception:
                return jsonify({'error': 'Invalid coordinates'}), 400
            # validate bounds
            if not (0 <= row < sudoku_logic.SIZE and 0 <= col < sudoku_logic.SIZE):
                return jsonify({'error': 'Invalid coordinates'}), 400
            # ensure the selected cell is empty in the current puzzle
            if puzzle[row][col] != 0:
                return jsonify({'error': 'Selected cell is not empty'}), 400
            val = solution[row][col]
            return jsonify({'row': row, 'col': col, 'value': val})

        # Backwards-compatible behavior: find first empty cell
        for i in range(sudoku_logic.SIZE):
            for j in range(sudoku_logic.SIZE):
                if puzzle[i][j] == 0:
                    val = solution[i][j]
                    return jsonify({'row': i, 'col': j, 'value': val})

        return jsonify({'error': 'No empty cells'}), 400
    except Exception as e:
        # ensure we always return JSON to the client
        return jsonify({'error': 'Server error', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)