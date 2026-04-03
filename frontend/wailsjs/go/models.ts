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
	export class ForeignKeyInfo {
	    name: string;
	    column_name: string;
	    ref_table: string;
	    ref_column: string;
	    on_update: string;
	    on_delete: string;
	    match_option?: string;
	
	    static createFrom(source: any = {}) {
	        return new ForeignKeyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.column_name = source["column_name"];
	        this.ref_table = source["ref_table"];
	        this.ref_column = source["ref_column"];
	        this.on_update = source["on_update"];
	        this.on_delete = source["on_delete"];
	        this.match_option = source["match_option"];
	    }
	}
	export class IndexInfo {
	    name: string;
	    type: string;
	    columns: string[];
	    unique: boolean;
	    primary_key: boolean;
	    nullable: boolean;
	    cardinality: number;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new IndexInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.columns = source["columns"];
	        this.unique = source["unique"];
	        this.primary_key = source["primary_key"];
	        this.nullable = source["nullable"];
	        this.cardinality = source["cardinality"];
	        this.comment = source["comment"];
	    }
	}
	export class SingleQueryResult {
	    query: string;
	    columns: string[];
	    rows: any[][];
	    row_count: number;
	    duration: string;
	    error?: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new SingleQueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.row_count = source["row_count"];
	        this.duration = source["duration"];
	        this.error = source["error"];
	        this.status = source["status"];
	    }
	}
	export class MultiQueryResult {
	    results: SingleQueryResult[];
	    total_count: number;
	    success_count: number;
	    error_count: number;
	    total_duration: string;
	    start_time: string;
	    end_time: string;
	
	    static createFrom(source: any = {}) {
	        return new MultiQueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.results = this.convertValues(source["results"], SingleQueryResult);
	        this.total_count = source["total_count"];
	        this.success_count = source["success_count"];
	        this.error_count = source["error_count"];
	        this.total_duration = source["total_duration"];
	        this.start_time = source["start_time"];
	        this.end_time = source["end_time"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
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
	export class TableStats {
	    row_count: number;
	    data_length: number;
	    index_length: number;
	    engine: string;
	    charset: string;
	    collation: string;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new TableStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.row_count = source["row_count"];
	        this.data_length = source["data_length"];
	        this.index_length = source["index_length"];
	        this.engine = source["engine"];
	        this.charset = source["charset"];
	        this.collation = source["collation"];
	        this.comment = source["comment"];
	    }
	}
	export class TestResult {
	    name: string;
	    success: boolean;
	    message: string;
	    time: string;
	
	    static createFrom(source: any = {}) {
	        return new TestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.success = source["success"];
	        this.message = source["message"];
	        this.time = source["time"];
	    }
	}

}

