# DB Client

A modern, cross-platform database client built with Go and Wails, featuring a beautiful UI and support for multiple database systems.

## Features

- **Multi-Database Support**: Connect to PostgreSQL, PolarDB, GaussDB, MySQL, SQLite, and Redis
- **Modern UI**: Clean, responsive interface with dark/light themes
- **SQL Editor**: Advanced query editor with syntax highlighting and autocomplete
- **Database Explorer**: Browse schemas, tables, views, functions, and more
- **Data Viewer**: View and edit table data with sorting, filtering, and pagination
- **Connection Management**: Save, organize, and quickly access your database connections
- **Query History**: Track and reuse your SQL queries
- **Table Operations**: View table structure, indexes, foreign keys, and statistics
- **Multi-Tab Interface**: Work with multiple queries and views simultaneously
- **Internationalization**: Support for multiple languages (Chinese/English)

## Supported Databases

- PostgreSQL
- PolarDB (Alibaba Cloud)
- GaussDB (Huawei Cloud)
- MySQL
- SQLite
- Redis

## Project Structure

```
db-client/
├── app.go              # Main application logic
├── main.go             # Entry point
├── db/                 # Database abstraction layer
│   ├── db.go           # Common types and interfaces
│   ├── manager.go      # Driver manager
│   └── drivers/        # Database drivers
│       ├── interface.go # Driver interface
│       ├── postgresql.go # PostgreSQL driver
│       ├── mysql.go     # MySQL driver
│       ├── sqlite.go    # SQLite driver
│       └── redis.go     # Redis driver
├── frontend/           # Frontend assets
│   └── dist/           # Built frontend
│       └── index.html  # Main HTML file
├── go.mod              # Go module file
├── build.sh            # Linux/Mac build script
└── build.bat           # Windows build script
```

## Prerequisites

1. Go 1.21 or later
2. Wails CLI v2.9.2 or later
3. Git (for cloning the repository)

## Installation

### Using Wails CLI

1. Install Wails CLI:
    ```bash
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    ```

2. Clone the repository:
    ```bash
    git clone <repository-url>
    cd db-client
    ```

3. Build the application:
    ```bash
    # On Windows
    build.bat
    
    # On Linux/Mac
    ./build.sh
    ```

### Direct Build

If you prefer to build manually:

```bash
# Install dependencies
go mod tidy

# Build for your platform
wails build
```

## Development

To run in development mode with hot reload:

```bash
wails dev
```

This will start the application and automatically reload when you make changes to the Go or frontend code.

## Usage Guide

### Connecting to a Database

1. Launch the application
2. In the sidebar, click the "+" button to add a new connection
3. Select your database type from the dropdown
4. Fill in the connection details:
   - Name: A friendly name for your connection
   - Host: Database server address
   - Port: Database port (default values pre-filled)
   - Username: Database user
   - Password: Database password
   - Database: Specific database to connect to (optional for some types)
5. Click "Test Connection" to verify your settings
6. Click "Save Connection" to save and connect

### Using the SQL Editor

1. Create a new query tab by clicking the "+" button in the tab bar or using the context menu
2. Select the target database from the dropdown in the editor toolbar
3. Write your SQL query in the editor (syntax highlighting and autocomplete available)
4. Click "Execute" or press Ctrl+Enter to run the query
5. View results in the results panel below the editor

### Exploring Database Objects

1. In the sidebar, expand a connection to see databases
2. Expand a database to see tables, views, functions, etc.
3. Click on any object to view its details in the main panel
4. For tables, you can view:
   - Data (with pagination)
   - Structure (columns, types, constraints)
   - Indexes
   - Foreign keys
   - Statistics

### Managing Connections

- Right-click on a connection in the sidebar to access the context menu
- Options include: connect, disconnect, edit, duplicate, delete
- Connections are saved automatically and persisted between sessions

## Architecture Overview

### Backend (Go)

- **App Layer** (`app.go`): Main application logic, Wails bindings, connection management
- **Database Abstraction** (`db/`):
  - `db.go`: Common types and interfaces
  - `manager.go`: Driver registration and lookup
  - `drivers/`: Individual database driver implementations
    - Each driver implements the `DatabaseDriver` interface
    - Handles connection, query execution, and schema inspection

### Frontend (Wails/React-inspired)

- **UI Components**: Custom-built UI with modern design
- **State Management**: Global state object for application state
- **Wails Integration**: Bridge between frontend and backend Go code
- **Features**:
  - Syntax highlighting editor with autocomplete
  - Resizable panels and split views
  - Context menus and keyboard shortcuts
  - Theme switching (dark/light)
  - Modal dialogs and notifications

## Adding New Database Drivers

To add support for a new database type:

1. Create a new driver file in `db/drivers/` (e.g., `mongodb.go`)
2. Implement the `DatabaseDriver` interface from `db/drivers/interface.go`:
   - `Connect()`: Establish a database connection
   - `Disconnect()`: Close the connection
   - `Ping()`: Test the connection
   - `ExecuteQuery()`: Run SELECT queries
   - `ExecuteNonQuery()`: Run INSERT/UPDATE/DELETE queries
   - Schema inspection methods: `GetDatabases()`, `GetTables()`, `GetTableColumns()`, etc.
3. Register the driver in `db/manager.go` in the `NewDriverManager()` function
4. Add UI support in `app.go`:
   - Add the database type to `GetSupportedDatabases()`
   - Add connection form fields in `updateConnectionForm()` if needed
5. Update the frontend to recognize the new database type if special handling is required

## Configuration

The application stores connection information and settings in:
- Windows: `%APPDATA%\db-client\`
- macOS: `$HOME/Library/Application Support/db-client/`
- Linux: `$HOME/.local/share/db-client/`

Connection data is stored encrypted when possible, but for maximum security, consider:
- Not saving passwords in the application
- Using environment variables or external secret management
- Ensuring your device is encrypted and protected

## Troubleshooting

### Common Issues

1. **Connection Failures**:
   - Verify network connectivity to the database server
   - Check firewall settings allow the connection
   - Confirm username/password are correct
   - Ensure the database service is running

2. **Performance Issues**:
   - Large result sets can be slow to render - use LIMIT clauses
   - Consider using pagination for large tables
   - Ensure you have adequate system resources

3. **UI Problems**:
   - Try switching themes (dark/light) to reset UI state
   - Restart the application if UI becomes unresponsive
   - Check the browser console (in dev mode) for errors

### Getting Help

If you encounter issues:
1. Check the application logs (available in the Help menu)
2. Search existing issues in the repository
3. Create a new issue with detailed information including:
   - Operating system and version
   - Database type and version
   - Steps to reproduce the problem
   - Any error messages or screenshots

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Wails](https://wails.io/) for Go desktop development
- Inspired by modern database clients and IDEs
- Thanks to the open-source community for various libraries and tools used