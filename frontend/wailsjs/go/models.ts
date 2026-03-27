export namespace db {
	
	export class ColumnInfo {
	    name: string;
	    type: string;
	    nullable: boolean;
	    default_value: string;
	    primary_key: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ColumnInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.nullable = source["nullable"];
	        this.default_value = source["default_value"];
	        this.primary_key = source["primary_key"];
	    }
	}

}

export namespace main {
	
	export class Connection {
	    id: string;
	    name: string;
	    type: string;
	    host: string;
	    port: number;
	    username: string;
	    password: string;
	    database: string;
	    ssl_mode?: string;
	    color: string;
	    save_password: boolean;
	    auto_connect: boolean;
	    last_connected?: string;
	
	    static createFrom(source: any = {}) {
	        return new Connection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.database = source["database"];
	        this.ssl_mode = source["ssl_mode"];
	        this.color = source["color"];
	        this.save_password = source["save_password"];
	        this.auto_connect = source["auto_connect"];
	        this.last_connected = source["last_connected"];
	    }
	}
	export class DatabaseInfo {
	    name: string;
	    owner?: string;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.owner = source["owner"];
	        this.comment = source["comment"];
	    }
	}
	export class QueryResult {
	    columns: string[];
	    rows: any[][];
	    row_count: number;
	    duration: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.row_count = source["row_count"];
	        this.duration = source["duration"];
	        this.error = source["error"];
	    }
	}
	export class TableInfo {
	    name: string;
	    type: string;
	    schema: string;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new TableInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.schema = source["schema"];
	        this.comment = source["comment"];
	    }
	}

}

