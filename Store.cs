using System.Text.Json;

// ---------- хранилище: один JSON-файл, запись атомарная ----------
partial class Store
{
    readonly string _path; readonly object _lock = new(); Data _d;
    static readonly JsonSerializerOptions J = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public Store(string path)
    {
        _path = path;
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        try
        {
            if (File.Exists(path))
            {
                var text = File.ReadAllText(path);
                // старый формат (просто список квизов) подхватывается автоматически
                _d = text.TrimStart().StartsWith("[")
                    ? new Data { Quizzes = JsonSerializer.Deserialize<List<Quiz>>(text, J) ?? new() }
                    : JsonSerializer.Deserialize<Data>(text, J) ?? new();
            }
            else _d = Seed();
        }
        catch { File.Copy(path, path + ".broken-" + DateTime.UtcNow.Ticks); _d = new(); } // битый файл не теряем
        if (_d.SeedVer < 2) { foreach (var z in Extra()) if (!_d.Quizzes.Any(x => x.Id == z.Id)) _d.Quizzes.Add(z); _d.SeedVer = 2; }
        if (_d.SeedVer < 3)
        {
            foreach (var z in Extra2()) if (!_d.Quizzes.Any(x => x.Id == z.Id)) _d.Quizzes.Add(z);
            foreach (var b in ExtraBoards()) if (!_d.Boards.Any(x => x.Id == b.Id)) _d.Boards.Add(b);
            _d.SeedVer = 3;
        }
        if (_d.SeedVer < 4)
        {
            foreach (var z in Extra3()) if (!_d.Quizzes.Any(x => x.Id == z.Id)) _d.Quizzes.Add(z);
            _d.SeedVer = 4;
        }
        if (_d.SeedVer < 5)
        {
            foreach (var z in Extra4()) if (!_d.Quizzes.Any(x => x.Id == z.Id)) _d.Quizzes.Add(z);
            _d.SeedVer = 5;
        }
        if (_d.SeedVer < 6)
        {
            foreach (var z in Extra5()) if (!_d.Quizzes.Any(x => x.Id == z.Id)) _d.Quizzes.Add(z);
            _d.SeedVer = 6;
        }
        Backup();
        _t = new Timer(_ => { lock (_lock) Backup(); }, null, TimeSpan.FromHours(6), TimeSpan.FromHours(6));
        Save();
    }

    public T Run<T>(Func<List<Quiz>, T> f, bool save = false)
    { lock (_lock) { var r = f(_d.Quizzes); if (save) Save(); return r; } }

    public T RunBoards<T>(Func<List<Board>, T> f, bool save = false)
    { lock (_lock) { var r = f(_d.Boards); if (save) Save(); return r; } }

    public T RunData<T>(Func<Data, T> f, bool save = false)
    { lock (_lock) { var r = f(_d); if (save) Save(); return r; } }

    readonly Timer _t;
    // копия data/quizzes.json в data/backups каждые 6 часов и при запуске, хранятся последние 20
    void Backup()
    {
        try
        {
            if (!File.Exists(_path)) return;
            var dir = Path.Combine(Path.GetDirectoryName(_path)!, "backups"); Directory.CreateDirectory(dir);
            File.Copy(_path, Path.Combine(dir, $"quizzes-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json"), true);
            foreach (var f in new DirectoryInfo(dir).GetFiles("quizzes-*.json").OrderByDescending(x => x.Name).Skip(20)) f.Delete();
        }
        catch { }
    }

    void Save()
    {
        var tmp = _path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(_d, J));
        File.Move(tmp, _path, true);
    }
}
