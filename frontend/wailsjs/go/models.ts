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
	
	export class AutoCompleteItem {
	    label: string;
	    kind: string;
	    detail?: string;
	    documentation?: string;
	    insertText: string;
	    sortText: string;
	
	    static createFrom(source: any = {}) {
	        return new AutoCompleteItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.kind = source["kind"];
	        this.detail = source["detail"];
	        this.documentation = source["documentation"];
	        this.insertText = source["insertText"];
	        this.sortText = source["sortText"];
	    }
	}
	export class AutoCompleteResult {
	    suggestions: AutoCompleteItem[];
	    from: number;
	    to: number;
	
	    static createFrom(source: any = {}) {
	        return new AutoCompleteResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.suggestions = this.convertValues(source["suggestions"], AutoCompleteItem);
	        this.from = source["from"];
	        this.to = source["to"];
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
	export class CompareRequest {
	    type: string;
	    mode: string;
	    sourceDB: string;
	    targetDB: string;
	    sourceTable?: string;
	    targetTable?: string;
	    sourceQuery?: string;
	    targetQuery?: string;
	    keyColumns?: string[];
	    compareColumns?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CompareRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.mode = source["mode"];
	        this.sourceDB = source["sourceDB"];
	        this.targetDB = source["targetDB"];
	        this.sourceTable = source["sourceTable"];
	        this.targetTable = source["targetTable"];
	        this.sourceQuery = source["sourceQuery"];
	        this.targetQuery = source["targetQuery"];
	        this.keyColumns = source["keyColumns"];
	        this.compareColumns = source["compareColumns"];
	    }
	}
	export class DifferenceItem {
	    rowKey: Record<string, any>;
	    columnName: string;
	    sourceValue: any;
	    targetValue: any;
	
	    static createFrom(source: any = {}) {
	        return new DifferenceItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rowKey = source["rowKey"];
	        this.columnName = source["columnName"];
	        this.sourceValue = source["sourceValue"];
	        this.targetValue = source["targetValue"];
	    }
	}
	export class CompareSummary {
	    sourceRowCount: number;
	    targetRowCount: number;
	    matchPercentage: number;
	    differenceCount: number;
	    missingInSourceCount: number;
	    missingInTargetCount: number;
	
	    static createFrom(source: any = {}) {
	        return new CompareSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceRowCount = source["sourceRowCount"];
	        this.targetRowCount = source["targetRowCount"];
	        this.matchPercentage = source["matchPercentage"];
	        this.differenceCount = source["differenceCount"];
	        this.missingInSourceCount = source["missingInSourceCount"];
	        this.missingInTargetCount = source["missingInTargetCount"];
	    }
	}
	export class CompareResult {
	    success: boolean;
	    message: string;
	    summary?: CompareSummary;
	    differences?: DifferenceItem[];
	    missingInSource?: any[];
	    missingInTarget?: any[];
	    identicalRows: number;
	    differentRows: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new CompareResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.summary = this.convertValues(source["summary"], CompareSummary);
	        this.differences = this.convertValues(source["differences"], DifferenceItem);
	        this.missingInSource = source["missingInSource"];
	        this.missingInTarget = source["missingInTarget"];
	        this.identicalRows = source["identicalRows"];
	        this.differentRows = source["differentRows"];
	        this.error = source["error"];
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
	
	export class EditRequest {
	    operation: string;
	    table: string;
	    database: string;
	    data: Record<string, any>;
	    whereClause?: string;
	    primaryKey?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new EditRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.operation = source["operation"];
	        this.table = source["table"];
	        this.database = source["database"];
	        this.data = source["data"];
	        this.whereClause = source["whereClause"];
	        this.primaryKey = source["primaryKey"];
	    }
	}
	export class EditResult {
	    success: boolean;
	    message: string;
	    rowsAffected: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new EditResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.rowsAffected = source["rowsAffected"];
	        this.error = source["error"];
	    }
	}
	export class ExplainNode {
	    id: number;
	    parentId?: number;
	    type: string;
	    relation?: string;
	    alias?: string;
	    rows?: number;
	    cost?: number;
	    time?: number;
	    index?: string;
	    filter?: string;
	    children?: ExplainNode[];
	    details?: Record<string, string>;
	    warnings?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ExplainNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parentId = source["parentId"];
	        this.type = source["type"];
	        this.relation = source["relation"];
	        this.alias = source["alias"];
	        this.rows = source["rows"];
	        this.cost = source["cost"];
	        this.time = source["time"];
	        this.index = source["index"];
	        this.filter = source["filter"];
	        this.children = this.convertValues(source["children"], ExplainNode);
	        this.details = source["details"];
	        this.warnings = source["warnings"];
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
	export class ExplainResult {
	    success: boolean;
	    rootNode?: ExplainNode;
	    totalCost?: number;
	    totalRows?: number;
	    totalTime?: number;
	    query: string;
	    warnings?: string[];
	    suggestions?: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ExplainResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.rootNode = this.convertValues(source["rootNode"], ExplainNode);
	        this.totalCost = source["totalCost"];
	        this.totalRows = source["totalRows"];
	        this.totalTime = source["totalTime"];
	        this.query = source["query"];
	        this.warnings = source["warnings"];
	        this.suggestions = source["suggestions"];
	        this.error = source["error"];
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
	export class ExportRequest {
	    format: string;
	    fileName: string;
	    query?: string;
	    table?: string;
	    database: string;
	    limit?: number;
	    offset?: number;
	
	    static createFrom(source: any = {}) {
	        return new ExportRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format = source["format"];
	        this.fileName = source["fileName"];
	        this.query = source["query"];
	        this.table = source["table"];
	        this.database = source["database"];
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	    }
	}
	export class ExportResult {
	    success: boolean;
	    fileName: string;
	    rowsCount: number;
	    message: string;
	    error?: string;
	    filePath?: string;
	
	    static createFrom(source: any = {}) {
	        return new ExportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.fileName = source["fileName"];
	        this.rowsCount = source["rowsCount"];
	        this.message = source["message"];
	        this.error = source["error"];
	        this.filePath = source["filePath"];
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
	export class FormatOptions {
	    indentWidth: number;
	    keywordCase: string;
	    lineBreakStyle: string;
	    alignClauses: boolean;
	    formatFunctions: boolean;
	    maxLineLength: number;
	
	    static createFrom(source: any = {}) {
	        return new FormatOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.indentWidth = source["indentWidth"];
	        this.keywordCase = source["keywordCase"];
	        this.lineBreakStyle = source["lineBreakStyle"];
	        this.alignClauses = source["alignClauses"];
	        this.formatFunctions = source["formatFunctions"];
	        this.maxLineLength = source["maxLineLength"];
	    }
	}
	export class ImportRequest {
	    format: string;
	    fileName: string;
	    table: string;
	    database: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format = source["format"];
	        this.fileName = source["fileName"];
	        this.table = source["table"];
	        this.database = source["database"];
	    }
	}
	export class ImportResult {
	    success: boolean;
	    rowsImported: number;
	    message: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.rowsImported = source["rowsImported"];
	        this.message = source["message"];
	        this.error = source["error"];
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
	export class QueryAnalysis {
	    queryType: string;
	    tables: string[];
	    indexes: Record<string, Array<string>>;
	    joinCount: number;
	    subqueryCount: number;
	    hasAggregate: boolean;
	    hasOrderBy: boolean;
	    hasGroupBy: boolean;
	    hasDistinct: boolean;
	    hasLimit: boolean;
	    hasUnion: boolean;
	    hasSubquery: boolean;
	    estimatedCost: number;
	    estimatedRows: number;
	    complexity: string;
	    recommendations: string[];
	
	    static createFrom(source: any = {}) {
	        return new QueryAnalysis(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.queryType = source["queryType"];
	        this.tables = source["tables"];
	        this.indexes = source["indexes"];
	        this.joinCount = source["joinCount"];
	        this.subqueryCount = source["subqueryCount"];
	        this.hasAggregate = source["hasAggregate"];
	        this.hasOrderBy = source["hasOrderBy"];
	        this.hasGroupBy = source["hasGroupBy"];
	        this.hasDistinct = source["hasDistinct"];
	        this.hasLimit = source["hasLimit"];
	        this.hasUnion = source["hasUnion"];
	        this.hasSubquery = source["hasSubquery"];
	        this.estimatedCost = source["estimatedCost"];
	        this.estimatedRows = source["estimatedRows"];
	        this.complexity = source["complexity"];
	        this.recommendations = source["recommendations"];
	    }
	}
	export class QueryOptions {
	    Timeout: number;
	
	    static createFrom(source: any = {}) {
	        return new QueryOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Timeout = source["Timeout"];
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

