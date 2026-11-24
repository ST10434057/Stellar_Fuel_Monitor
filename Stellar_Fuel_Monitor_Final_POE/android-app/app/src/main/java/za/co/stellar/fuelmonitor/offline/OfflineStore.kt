package za.co.stellar.fuelmonitor.offline

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

data class PendingAction(
    val id: Long,
    val type: String,
    val targetId: String,
    val payloadJson: String,
    val createdAt: Long,
    val attempts: Int,
    val lastError: String?
)

/**
 * SQLite-backed resilient offline layer.
 * It stores pending write actions and cached JSON snapshots used when the API is unavailable.
 */
class OfflineStore(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE pending_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            )""".trimIndent()
        )
        db.execSQL("CREATE INDEX idx_pending_created ON pending_actions(created_at)")
        db.execSQL(
            """CREATE TABLE response_cache (
                cache_key TEXT PRIMARY KEY,
                json_value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )""".trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL(
                """CREATE TABLE IF NOT EXISTS response_cache (
                    cache_key TEXT PRIMARY KEY,
                    json_value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )""".trimIndent()
            )
        }
    }

    @Synchronized
    fun enqueue(type: String, targetId: String, payloadJson: String): Long {
        val values = ContentValues().apply {
            put("action_type", type)
            put("target_id", targetId)
            put("payload_json", payloadJson)
            put("created_at", System.currentTimeMillis())
            put("attempts", 0)
        }
        val id = writableDatabase.insertOrThrow("pending_actions", null, values)
        Log.i(TAG, "Queued offline action id=$id type=$type target=$targetId")
        return id
    }

    @Synchronized
    fun pending(limit: Int = 100): List<PendingAction> {
        val items = mutableListOf<PendingAction>()
        readableDatabase.query(
            "pending_actions",
            arrayOf("id", "action_type", "target_id", "payload_json", "created_at", "attempts", "last_error"),
            null, null, null, null,
            "created_at ASC",
            limit.coerceIn(1, 500).toString()
        ).use { cursor ->
            while (cursor.moveToNext()) {
                items += PendingAction(
                    id = cursor.getLong(0),
                    type = cursor.getString(1),
                    targetId = cursor.getString(2),
                    payloadJson = cursor.getString(3),
                    createdAt = cursor.getLong(4),
                    attempts = cursor.getInt(5),
                    lastError = cursor.getString(6)
                )
            }
        }
        return items
    }

    @Synchronized
    fun pendingCount(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM pending_actions", null).use { cursor ->
        if (cursor.moveToFirst()) cursor.getInt(0) else 0
    }

    @Synchronized
    fun delete(id: Long) {
        writableDatabase.delete("pending_actions", "id = ?", arrayOf(id.toString()))
    }

    @Synchronized
    fun markFailed(id: Long, message: String) {
        val values = ContentValues().apply {
            put("last_error", message.take(500))
        }
        writableDatabase.execSQL(
            "UPDATE pending_actions SET attempts = attempts + 1, last_error = ? WHERE id = ?",
            arrayOf(values.getAsString("last_error"), id)
        )
    }

    @Synchronized
    fun cachePut(key: String, json: String) {
        writableDatabase.insertWithOnConflict(
            "response_cache",
            null,
            ContentValues().apply {
                put("cache_key", key)
                put("json_value", json)
                put("updated_at", System.currentTimeMillis())
            },
            SQLiteDatabase.CONFLICT_REPLACE
        )
    }

    @Synchronized
    fun cacheGet(key: String): String? = readableDatabase.query(
        "response_cache",
        arrayOf("json_value"),
        "cache_key = ?",
        arrayOf(key),
        null, null, null,
        "1"
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

    @Synchronized
    fun clearCache() {
        writableDatabase.delete("response_cache", null, null)
    }

    companion object {
        private const val TAG = "StellarOffline"
        private const val DB_NAME = "stellar_offline.db"
        private const val DB_VERSION = 2
        const val ACTION_ALERT_UPDATE = "alert_update"
    }
}
