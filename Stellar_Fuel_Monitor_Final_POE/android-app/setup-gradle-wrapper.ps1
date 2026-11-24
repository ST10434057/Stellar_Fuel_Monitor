$ErrorActionPreference = "Stop"

$gradleVersion = "8.10.2"
$downloadUrl = "https://services.gradle.org/distributions/gradle-$gradleVersion-bin.zip"
$workingDirectory = Join-Path $env:TEMP "stellar-gradle-$gradleVersion"
$archivePath = Join-Path $workingDirectory "gradle-$gradleVersion-bin.zip"
$gradleDirectory = Join-Path $workingDirectory "gradle-$gradleVersion"
$gradleExecutable = Join-Path $gradleDirectory "bin\gradle.bat"

New-Item -ItemType Directory -Force -Path $workingDirectory | Out-Null

if (-not (Test-Path $gradleExecutable)) {
    Write-Host "Downloading Gradle $gradleVersion..."
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
    Expand-Archive -Path $archivePath -DestinationPath $workingDirectory -Force
}

Write-Host "Generating the project Gradle wrapper..."
& $gradleExecutable wrapper --gradle-version $gradleVersion --distribution-type bin

if ($LASTEXITCODE -ne 0) {
    throw "Gradle wrapper generation failed with exit code $LASTEXITCODE."
}

Write-Host "Wrapper created. Use .\gradlew.bat :app:testDebugUnitTest and .\gradlew.bat :app:assembleDebug."
