# Bake the three otherwise device-dependent question lines into portable recordings.
# Run on Windows with the Microsoft Zira Desktop voice installed. Existing studio
# recordings are untouched. SpeakProgress supplies word times from the audio clock.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public class LessonWord {
    public string word;
    public double start;
}
public static class LessonVoice {
    public static LessonWord[] Render(string text, string destination) {
        var words = new List<LessonWord>();
        using (var synth = new SpeechSynthesizer()) {
            synth.SelectVoice("Microsoft Zira Desktop");
            synth.Rate = 0;
            synth.Volume = 100;
            synth.SpeakProgress += (sender, e) => words.Add(new LessonWord {
                word = e.Text, start = Math.Round(e.AudioPosition.TotalSeconds, 4)
            });
            synth.SetOutputToWaveFile(destination, new SpeechAudioFormatInfo(24000, AudioBitsPerSample.Sixteen, AudioChannel.Mono));
            synth.Speak(text);
        }
        return words.ToArray();
    }
}
'@
$lessonLines = @(
    @{ name='77_Select_polygons.wav'; text='Which of these are polygons?' },
    @{ name='78_Not_a_polygon.wav'; text='Which figure is NOT a polygon?' },
    @{ name='79_Select_pentagons.wav'; text='Which of these are pentagons?' }
)
$lessonRows = foreach ($line in $lessonLines) {
    $destination = Join-Path $PSScriptRoot ('voice overs/' + $line.name)
    $words = [LessonVoice]::Render($line.text, $destination)
    $wave = [IO.File]::ReadAllBytes($destination)
    $offset = 12
    $bytesPerSecond = 0
    $dataSize = 0
    while ($offset + 8 -le $wave.Length) {
        $chunk = [Text.Encoding]::ASCII.GetString($wave, $offset, 4)
        $size = [BitConverter]::ToUInt32($wave, $offset + 4)
        if ($chunk -eq 'fmt ') { $bytesPerSecond = [BitConverter]::ToUInt32($wave, $offset + 16) }
        if ($chunk -eq 'data') { $dataSize = $size }
        $offset += 8 + $size + ($size % 2)
    }
    if (!$dataSize -or !$bytesPerSecond) { throw "Invalid wave: $destination" }
    @{
        text=$line.text
        src=('voiceovers/voice%20overs/' + $line.name)
        duration=[Math]::Round($dataSize / $bytesPerSecond, 4)
        words=@($words)
        source='Microsoft Zira Desktop; generated locally with System.Speech'
    }
}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'fallback-recordings.json'),
    (ConvertTo-Json -InputObject @($lessonRows) -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Output 'Generated three WAV recordings and fallback-recordings.json. Merge these entries into recordings.js.'
