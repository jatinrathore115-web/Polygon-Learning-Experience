# Render a lesson line with an Indian English voice.
#
# System.Speech (used by the other build scripts) only sees the "Desktop"
# voices, which on this machine are US and UK only. The Indian English voices
# -- Heera and Ravi -- are installed as OneCore voices, which only the WinRT
# synthesiser can reach. So this script uses Windows.Media.SpeechSynthesis and
# reads word timings from the stream's markers, which is the same thing the
# word-by-word reveal needs from SpeakProgress elsewhere.
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
                   $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
    Select-Object -First 1
function Await($op, $type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    $task.Result
}

[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices |
    Where-Object { $_.Language -eq 'en-IN' -and $_.Gender -eq 'Female' } | Select-Object -First 1
if (-not $voice) {
    $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices |
        Where-Object { $_.Language -eq 'en-IN' } | Select-Object -First 1
}
if (-not $voice) { throw 'No en-IN voice is installed.' }
$synth.Voice = $voice
$synth.Options.IncludeWordBoundaryMetadata = $true
# A touch under normal pace and slightly up in pitch: the lesson is read to a
# child, and the studio takes are unhurried and bright.
$synth.Options.SpeakingRate = 0.9
$synth.Options.AudioPitch = 1.1

$lines = @(
    @{ name = '88_Lets_count_the_sides_of_the_polygon.wav'; text = "Let's count the sides of the polygon." }
)

$rows = foreach ($line in $lines) {
    $stream = Await $synth.SynthesizeTextToStreamAsync($line.text) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])

    # Word markers: one per spoken word, in media time.
    $words = @()
    foreach ($m in $stream.Markers) {
        if ($m.MediaMarkerType -eq 'Word' -or $m.Text) {
            $words += @{ word = $m.Text; start = [Math]::Round($m.Time.TotalSeconds, 4) }
        }
    }

    # Copy the stream out to a real file.
    $destination = Join-Path $PSScriptRoot ('voice overs/' + $line.name)
    $input = $stream.GetInputStreamAt(0)
    $reader = New-Object Windows.Storage.Streams.DataReader($input)
    Await $reader.LoadAsync([uint32]$stream.Size) ([uint32]) | Out-Null
    $bytes = New-Object byte[] $stream.Size
    $reader.ReadBytes($bytes)
    [IO.File]::WriteAllBytes($destination, $bytes)
    $reader.Dispose()

    @{
        text     = $line.text
        src      = ('voiceovers/voice%20overs/' + $line.name)
        duration = [Math]::Round($stream.Duration.TotalSeconds, 4)
        words    = @($words)
        source   = ('Windows OneCore ' + $voice.DisplayName + ' (' + $voice.Language + '); generated locally with Windows.Media.SpeechSynthesis')
    }
}

[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'indian-recordings.json'),
    (ConvertTo-Json -InputObject @($rows) -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Output ('Rendered with ' + $voice.DisplayName + ' (' + $voice.Language + '): ' + $rows.Count + ' line(s).')
foreach ($r in $rows) { Write-Output ('  ' + $r.duration + 's  ' + $r.words.Count + ' word markers  ' + $r.text) }
