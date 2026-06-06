using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

public class VemalexCrmLauncher
{
    public static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string envFile = Path.Combine(appDir, ".env");
        string envExample = Path.Combine(appDir, ".env.example");

        if (!File.Exists(envFile) && File.Exists(envExample))
        {
            File.Copy(envExample, envFile);
            Process.Start(new ProcessStartInfo("notepad.exe", "\"" + envFile + "\"") { UseShellExecute = true });
        }

        string node = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".cache",
            "codex-runtimes",
            "codex-primary-runtime",
            "dependencies",
            "node",
            "bin",
            "node.exe"
        );
        if (!File.Exists(node)) node = "node";

        Process.Start(new ProcessStartInfo
        {
            FileName = node,
            Arguments = "server.js",
            WorkingDirectory = appDir,
            UseShellExecute = false,
            CreateNoWindow = true
        });

        Thread.Sleep(1800);
        Process.Start(new ProcessStartInfo("http://127.0.0.1:8787") { UseShellExecute = true });
    }
}
