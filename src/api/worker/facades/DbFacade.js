//@flow
import {DbError} from "../../common/error/DbError"

export const SearchIndexOS = "SearchIndex"
export const ElementIdToListIdOS = "ElementIdToListIdIndex"
export const MetaDataOS = "MetaData"
export const GroupIdToBatchIdsOS = "GroupIdToBatchIds"


export class DbFacade {
	db: IDBDatabase;

	constructor() {
	}

	open(id: string): Promise<DbFacade> {
		if (this.db != null) return Promise.resolve()
		return new Promise.fromCallback((callback) => {
			let DBOpenRequest = indexedDB.open(id, 1);

			DBOpenRequest.onerror = (event) => {
				callback(new DbError("could not open indexeddb tutanota", event), null)
			}

			DBOpenRequest.onupgradeneeded = (event) => {
				//console.log("upgrade db", event)
				let db = event.target.result
				try {
					db.createObjectStore(SearchIndexOS)
					db.createObjectStore(ElementIdToListIdOS)
					db.createObjectStore(MetaDataOS)
					db.createObjectStore(GroupIdToBatchIdsOS)
				} catch (e) {
					callback(new DbError("could not create object store searchindex", e))
				}
			}

			DBOpenRequest.onsuccess = (event) => {
				//console.log("opened db", event)
				this.db = DBOpenRequest.result;
				this.db.onabort = (event) => console.log("db aborted", event)
				this.db.onclose = (event) => console.log("db closed", event)
				this.db.onerror = (event) => console.log("db error", event)
				callback(null, this)
			}
		})
	}


	deleteDatabase() {
		indexedDB.deleteDatabase(this.db.name)
	}


	createTransaction(readOnly: boolean, objectStores: string[]): DbTransaction {
		return new DbTransaction(this.db.transaction(objectStores, readOnly ? "readonly" : "readwrite"))
	}

}

type DbRequest = {
	action: Function;
	objectStore:string;
}

class DbTransaction {
	_transaction: IDBTransaction;
	_promise: Promise<void>;

	constructor(transaction: IDBTransaction) {
		this._transaction = transaction
		this._promise = Promise.fromCallback((callback) => {
			transaction.onerror = (event) => {
				callback(new DbError("IDB transaction error!", event))
			}
			transaction.oncomplete = (event) => {
				callback()
			}
			transaction.onabort = (event) => {
				callback(new DbError("IDB transaction aborted!", event))
			}
		})
	}

	get(objectStore: string, key: string|Uint8Array): Promise<any> {
		return Promise.fromCallback((callback) => {
			try {
				let request = this._transaction.objectStore(objectStore).get(key)
				request.onerror = (event) => {
					callback(new DbError("IDB Unable to retrieve data from database!", event))
				}
				request.onsuccess = (event) => {
					callback(null, event.target.result)
				}
			} catch (e) {
				callback(new DbError("IDB could not get data", e))
			}
		})
	}

	getAsList(objectStore: string, key: string|Uint8Array): Promise<any[]> {
		return this.get(objectStore, key).then(result => {
			if (!result) {
				return []
			}
			return result
		})
	}


	put(objectStore: string, key: string|Uint8Array, value: any): Promise<void> {
		return Promise.fromCallback((callback) => {
			try {
				let request = this._transaction.objectStore(objectStore).put(value, key)
				request.onerror = (event) => {
					callback(new DbError("IDB Unable to write data to database!", event))
				}
				request.onsuccess = (event) => {
					callback()
				}
			} catch (e) {
				callback(new DbError("IDB could not write data", e))
			}
		})
	}

	await(): Promise<void> {
		return this._promise
	}
}