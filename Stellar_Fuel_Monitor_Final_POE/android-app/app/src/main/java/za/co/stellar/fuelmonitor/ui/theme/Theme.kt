package za.co.stellar.fuelmonitor.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val StellarNavy = Color(0xFF123A5A)
val StellarBlue = Color(0xFF1E6E9E)
val StellarCyan = Color(0xFF4DB7D8)
val StellarSurface = Color(0xFFF4F8FA)
val StellarGood = Color(0xFF2E7D32)
val StellarWarning = Color(0xFFB7791F)
val StellarDanger = Color(0xFFB42318)
val StellarPurple = Color(0xFF6B4FA3)

private val StellarColors = lightColorScheme(
    primary = StellarNavy,
    secondary = StellarBlue,
    tertiary = StellarCyan,
    background = StellarSurface,
    surface = Color.White,
    error = StellarDanger
)

private val StellarTypography = Typography(
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 23.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 21.sp
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp
    )
)

@Composable
fun StellarTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = StellarColors,
        typography = StellarTypography,
        content = content
    )
}
