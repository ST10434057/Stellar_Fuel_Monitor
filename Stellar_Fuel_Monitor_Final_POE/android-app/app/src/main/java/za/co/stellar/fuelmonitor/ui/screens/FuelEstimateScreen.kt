package za.co.stellar.fuelmonitor.ui.screens

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import za.co.stellar.fuelmonitor.data.FuelEstimateRequest
import za.co.stellar.fuelmonitor.data.FuelEstimateResponse
import za.co.stellar.fuelmonitor.data.StellarRepository
import za.co.stellar.fuelmonitor.ui.components.*

@Composable
fun FuelEstimateScreen(repository: StellarRepository, onBack: () -> Unit) {
    var truck by remember { mutableStateOf("9") }
    var trailer by remember { mutableStateOf("8") }
    var cargo by remember { mutableStateOf("34") }
    var returnCargo by remember { mutableStateOf("0") }
    var loadedPct by remember { mutableStateOf("50") }
    var distance by remember { mutableStateOf("500") }
    var baseline by remember { mutableStateOf("28") }
    var result by remember { mutableStateOf<FuelEstimateResponse?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun parse(value: String) = value.toDoubleOrNull()
    val valid = listOf(truck, trailer, cargo, returnCargo, loadedPct, distance, baseline).all { parse(it) != null } && (parse(distance) ?: 0.0) > 0.0

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        BackTitle("Fuel Estimate", "Weight-aware fuel estimate using the Stellar REST API", onBack)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NumberField("Truck t", truck, { truck = it }, Modifier.weight(1f))
            NumberField("Trailer t", trailer, { trailer = it }, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NumberField("Outbound cargo t", cargo, { cargo = it }, Modifier.weight(1f))
            NumberField("Return cargo t", returnCargo, { returnCargo = it }, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NumberField("Loaded distance %", loadedPct, { loadedPct = it }, Modifier.weight(1f))
            NumberField("Distance km", distance, { distance = it }, Modifier.weight(1f))
        }
        NumberField("Baseline L/100km", baseline, { baseline = it }, Modifier.fillMaxWidth())
        Button(
            enabled = valid && !busy,
            onClick = {
                busy = true; error = null; result = null
                scope.launch {
                    val request = FuelEstimateRequest(
                        truckWeight = parse(truck)!!,
                        trailerWeight = parse(trailer)!!,
                        cargoWeight = parse(cargo)!!,
                        returnCargoWeight = parse(returnCargo)!!,
                        loadedDistancePct = parse(loadedPct)!!,
                        distanceKm = parse(distance)!!,
                        baselineRate = parse(baseline)!!
                    )
                    repository.safely("fuel estimate") { repository.fuelEstimate(request) }
                        .onSuccess { result = it }
                        .onFailure { error = it.message }
                    busy = false
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (busy) "Calculating…" else "Calculate") }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        result?.let { r ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    KeyValue("Average gross", r.averageGrossTonnes?.let { "${it.oneDecimal()} t" } ?: "—")
                    KeyValue("Average cargo", r.averageCargoWeight?.let { "${it.oneDecimal()} t" } ?: "—")
                    KeyValue("Adjusted rate", r.adjustedRateLper100km?.let { "${it.oneDecimal()} L/100km" } ?: "—")
                    KeyValue("Estimated fuel", r.fuelLitres?.let { "${it.oneDecimal()} L" } ?: "—")
                    r.note?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun NumberField(label: String, value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = { next -> if (next.all { it.isDigit() || it == '.' }) onValueChange(next) },
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        singleLine = true,
        modifier = modifier
    )
}
