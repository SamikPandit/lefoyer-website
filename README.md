# Le Foyer E-Commerce Website

This is the repository for the Le Foyer e-commerce website, a full-stack application built with React and Django.

## Project Structure

- `backend/`: Django project
- `frontend/`: React project

## Setup

### Backend

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    ```
3.  Activate the virtual environment:
    -   **Windows:**
        ```bash
        venv\Scripts\activate
        ```
    -   **macOS/Linux:**
        ```bash
        source venv/bin/activate
        ```
4.  Install the dependencies:
    ```bash
    pip install -r requirements.txt
    ```
5.  Run the database migrations:
    ```bash
    python manage.py migrate
    ```
6.  Start the development server:
    ```bash
    python manage.py runserver
    ```

### Frontend

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
