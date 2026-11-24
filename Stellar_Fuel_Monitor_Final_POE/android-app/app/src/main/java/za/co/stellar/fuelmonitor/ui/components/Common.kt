package za.co.stellar.fuelmonitor.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import za.co.stellar.fuelmonitor.ui.theme.*
import za.co.stellar.fuelmonitor.localization.tr
import java.util.Locale

@Composable
fun PageTitle(title: String, subtitle: String? = null, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(tr(title), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = StellarNavy)
        if (!subtitle.isNullOrBlank()) Text(tr(subtitle), style = MaterialTheme.typography.bodyMedium, color = Color.DarkGray)
    }
}

@Composable
fun BackTitle(title: String, subtitle: String? = null, onBack: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = tr("Go back")
            )
        }
        PageTitle(title, subtitle, Modifier.weight(1f).padding(top = 8.dp))
    }
}

@Composable
fun StatusPill(status: String?, modifier: Modifier = Modifier) {
    val value = status ?: "Baseline"
    val color = when (value.lowercase()) {
        "poor", "high" -> StellarDanger
        "review", "investigating", "medium" -> StellarWarning
        "good", "resolved" -> StellarGood
        "outstanding" -> StellarPurple
        "data warning" -> Color(0xFF8B4513)
        else -> StellarBlue
    }
    Surface(modifier = modifier, color = color.copy(alpha = 0.12f), shape = RoundedCornerShape(50)) {
        Text(
            tr(value),
            color = color,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
        )
    }
}

@Composable
fun KpiCard(label: String, value: String, supporting: String? = null, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp)) {
            Text(tr(label), style = MaterialTheme.typography.labelMedium, color = Color.DarkGray)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = StellarNavy)
            if (!supporting.isNullOrBlank()) Text(tr(supporting), style = MaterialTheme.typography.bodySmall, color = Color.Gray, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun ErrorCard(message: String, onRetry: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Column(Modifier.padding(16.dp)) {
            Text(tr("Could not load this data"), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onErrorContainer)
            Text(message, color = MaterialTheme.colorScheme.onErrorContainer)
            if (onRetry != null) {
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onRetry) { Text(tr("Retry")) }
            }
        }
    }
}

@Composable
fun LoadingBlock(label: String = "Loading…") {
    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator()
            Spacer(Modifier.height(10.dp))
            Text(tr(label))
        }
    }
}

@Composable
fun EmptyState(title: String, body: String) {
    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(tr(title), fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(tr(body), color = Color.Gray, textAlign = TextAlign.Center)
        }
    }
}

fun Double?.kmL(): String = this?.let { String.format(Locale.US, "%.2f km/L", it) } ?: "—"
fun Double?.oneDecimal(): String = this?.let { String.format(Locale.US, "%.1f", it) } ?: "—"
fun Double?.percent(): String = this?.let { String.format(Locale.US, "%+.1f%%", it) } ?: "—"

@Composable
fun KeyValue(label: String, value: String, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().padding(vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(tr(label), color = Color.Gray, modifier = Modifier.weight(1f))
        Text(value, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}
