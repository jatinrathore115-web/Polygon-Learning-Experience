# Bake the lesson lines that have no studio recording into portable WAVs.
#
# Same approach as build-fallback-audio.ps1 and the same voice, so these sit
# alongside the three question lines already generated this way rather than
# introducing a second synthetic voice. SpeakProgress supplies word times from
# the audio clock, which is what drives the word-by-word reveal on the sign.
#
# Existing studio recordings are never touched. Re-running is safe: each file
# is rewritten from its line, and the JSON is regenerated from scratch.
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
public static class LessonVoiceMissing {
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

# The lines the lesson speaks that no studio recording matches. Numerals are
# written as words here so the synthesiser reads them the way the studio
# recordings do ("five sides", not "five" as a digit glyph); the player
# normalises digits either way, so the on-screen text keeps its own spelling.
$lines = @(
    @{ name = '80_Tap_the_closed_figure_made_with_straight_lines.wav'; text = 'Tap the closed figure made with straight lines.' },
    @{ name = '81_Great_job_You_identified_all_the_polygons.wav';      text = 'Great job! You identified all the polygons.' },
    @{ name = '82_Correct_This_polygon_has_five_sides.wav';            text = 'Correct! This polygon has five sides.' },
    @{ name = '83_Thats_right_Quadrilaterals_are_polygons.wav';        text = 'That''s right! Quadrilaterals are polygons with four sides.' },
    @{ name = '84_Quadrilaterals_are_polygons_with_four_sides.wav';    text = 'Quadrilaterals are polygons with four sides.' },
    @{ name = '85_Is_this_shape_a_quadrilateral.wav';                  text = 'Is this shape a quadrilateral?' },
    @{ name = '86_A_polygon_is_a_closed_figure.wav';                   text = 'A polygon is a closed figure made only of straight sides.' },
    @{ name = '87_Not_quite_A_polygon_is_closed.wav';                  text = 'Not quite! A polygon is closed with only straight sides.' }
)

$rows = foreach ($line in $lines) {
    $destination = Join-Path $PSScriptRoot ('voice overs/' + $line.name)
    $words = [LessonVoiceMissing]::Render($line.text, $destination)

    # Duration comes from the wave header rather than the synthesiser, because
    # the file is what the browser will actually play.
    $wave = [IO.File]::ReadAllBytes($destination)
    $offset = 12
    $bytesPerSecond = 0
    $dataSize = 0
    while ($offset + 8 -le $wave.Length) {
        $chunk = [Text.Encoding]::ASCII.GetString($wave, $offset, 4)
        $size = [BitConverter]::ToUInt32($wave, $offset + 4)
        if ($chunk -eq 'fmt ')  { $bytesPerSecond = [BitConverter]::ToUInt32($wave, $offset + 16) }
        if ($chunk -eq 'data')  { $dataSize = $size }
        $offset += 8 + $size + ($size % 2)
    }
    if (!$dataSize -or !$bytesPerSecond) { throw "Invalid wave: $destination" }

    @{
        text     = $line.text
        src      = ('voiceovers/voice%20overs/' + $line.name)
        duration = [Math]::Round($dataSize / $bytesPerSecond, 4)
        words    = @($words)
        source   = 'Microsoft Zira Desktop; generated locally with System.Speech'
    }
}

[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'missing-recordings.json'),
    (ConvertTo-Json -InputObject @($rows) -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Output ("Generated " + $rows.Count + " WAV recordings and missing-recordings.json.")
