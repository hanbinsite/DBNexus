# DB Client

A cross-platform database client built with Go and Wails, supporting multiple database types.

## Supported Databases

- PostgreSQL
- PolarDB
- GaussDB
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

## Installation

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

## Development

To run in development mode:

```bash
wails dev
```

## Usage

1. Launch the application
2. Select database type from the dropdown
3. Enter connection details (host, port, username, password, database)
4. Click "Connect" to establish a connection

## Adding New Database Drivers

1. Create a new driver file in `db/drivers/`
2. Implement the `DatabaseDriver` interface
3. Register the driver in `db/manager.go`

## License

MIT