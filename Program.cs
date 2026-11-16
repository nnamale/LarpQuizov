using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 1_500_000);

// Заголовку CF-Connecting-IP верим ТОЛЬКО если включено LARP_BEHIND_CF=1 и запрос пришёл с доверенного адреса
// (по умолчанию localhost, туда приходит cloudflared; свои адреса прокси: LARP_PROXY_IPS=1.2.3.4,5.6.7.8)
var behindCf = Environment.GetEnvironmentVariable("LARP_BEHIND_CF") == "1";
var proxyIps = (Environment.GetEnvironmentVariable("LARP_PROXY_IPS") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();
string ClientIp(HttpContext c)
{
    var remote = c.Connection.RemoteIpAddress;
    var trusted = behindCf && remote is not null && (System.Net.IPAddress.IsLoopback(remote) || proxyIps.Contains(remote.ToString()));
    if (trusted) { var h = c.Request.Headers["CF-Connecting-IP"].FirstOrDefault(); if (!string.IsNullOrEmpty(h)) return h; }
    return remote?.ToString() ?? "x";
}
RateLimitPartition<string> Lim(string key, int n, TimeSpan w) =>
    RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions { PermitLimit = n, Window = w });
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    // общий лимит на API (статика его не считает: UseRateLimiter стоит после UseStaticFiles)
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(c => Lim("g|" + ClientIp(c), 240, TimeSpan.FromMinutes(1)));
    o.AddPolicy("auth", c => Lim("a|" + ClientIp(c), 10, TimeSpan.FromMinutes(1)));     // вход, регистрация, смена пароля
    o.AddPolicy("upload", c => Lim("u|" + ClientIp(c), 10, TimeSpan.FromMinutes(1)));   // загрузка фото
    o.AddPolicy("game", c => Lim("p|" + ClientIp(c), 120, TimeSpan.FromMinutes(1)));    // игровые запросы
    o.AddPolicy("write", c => Lim("w|" + ClientIp(c), 20, TimeSpan.FromMinutes(1)));    // создание квизов, игр, жалоб
});
var app = builder.Build();
var logLock = new object();
app.UseExceptionHandler(a => a.Run(async c =>
{
    var ex = c.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    Log("ERROR " + c.Request.Method + " " + c.Request.Path + " " + ex); // с полным стеком вызовов
    c.Response.StatusCode = 500; await c.Response.WriteAsJsonAsync(new { error = "Ошибка сервера" });
}));
app.Use(async (c, next) =>
{
    var h = c.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff"; h["X-Frame-Options"] = "DENY"; h["Referrer-Policy"] = "same-origin";
    h["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://commons.wikimedia.org; frame-ancestors 'none'";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
var imgDir = Path.Combine(app.Environment.ContentRootPath, "data", "img"); Directory.CreateDirectory(imgDir);
app.UseStaticFiles(new StaticFileOptions { FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(imgDir), RequestPath = "/img" });
app.UseRateLimiter();

// Вся база данных лежит в одном текстовом файле: data/quizzes.json
var db = new Store(Path.Combine(app.Environment.ContentRootPath, "data", "quizzes.json"));

string Cut(string? s, int max) => Logic.Cut(s, max);
object Summary(Quiz q) => new { q.Id, q.Title, q.Description, q.Category, q.Emoji, q.TimeLimit, q.Plays, q.Created, Count = q.Questions.Count };
string Norm(string s) => Logic.Norm(s);
void Log(string m) { try { lock (logLock) File.AppendAllText(Path.Combine(app.Environment.ContentRootPath, "data", "app.log"), $"{DateTime.UtcNow:u} {m}\n"); } catch { } }
// Роль admin НЕ выдаётся по имени. Первый админ получает её по секретному коду LARP_ADMIN_CODE (см. /api/admin/claim),
// остальные админы назначаются в админ-панели. Так нельзя занять «громкое» имя и стать админом.
void Mod(Data d, User admin, string action, string target, string details) // история действий модераторов (вызывать внутри db.RunData)
{
    d.ModLog.Add(new ModRec(admin.Name, action, target, details, DateTime.UtcNow));
    if (d.ModLog.Count > 1000) d.ModLog.RemoveRange(0, d.ModLog.Count - 1000);
}
object PubTop(Quiz q, int n = 10) => q.Scores.OrderByDescending(s => s.Points).Take(n).Select(s => new { s.Name, s.Points, s.Correct, s.At }).ToList();
var grace = int.TryParse(Environment.GetEnvironmentVariable("LARP_GRACE_MS"), out var gm) ? gm : 800; // допуск на сетевую задержку, мс
bool ImgOk(string? s) => Logic.ImgOk(s);
void SweepImgs()
{
    try
    {
        var used = db.Run(l => l.SelectMany(q => q.Questions).SelectMany(x => new[] { x.Image }.Concat(x.OptImages ?? Array.Empty<string>()))
            .Where(s => !string.IsNullOrEmpty(s)).Select(s => Path.GetFileName(s)).ToHashSet());
        db.RunData(d =>
        {
            foreach (var f in Directory.GetFiles(imgDir, "*.jpg")) { var n = Path.GetFileName(f); if (!d.Images.Any(i => i.Name == n)) d.Images.Add(new ImgRec(n, "", File.GetCreationTimeUtc(f))); } // старые файлы тоже учитываем
            foreach (var im in d.Images.Where(i => !used.Contains(i.Name) && DateTime.UtcNow - i.At > TimeSpan.FromHours(1)).ToList())
            { try { File.Delete(Path.Combine(imgDir, im.Name)); } catch { } d.Images.Remove(im); }
            return 0;
        }, true);
    }
    catch (Exception e) { Log("sweep-img " + e.Message); }
}
IResult Gone(string m) => Results.Json(new { error = m }, statusCode: 410);
IResult Bad(string m) => Results.BadRequest(new { error = m });
IResult NotFound() => Results.NotFound(new { error = "Не найдено" });
int Points(bool ok, int ms, int limit) => Logic.Points(ok, ms, limit);

// =====================  КВИЗЫ  =====================
app.MapGet("/api/quizzes", () => db.Run(l => l.OrderByDescending(q => q.Created).Select(Summary).ToList()));

app.MapGet("/api/quizzes/random", () => db.Run(l => l.Count == 0 ? NotFound() : Results.Ok(new { id = l[Random.Shared.Next(l.Count)].Id })));
app.MapGet("/api/quizzes/{id}", (string id) => db.Run(l =>
{
    var q = l.FirstOrDefault(x => x.Id == id);
    if (q is null) return NotFound();
    // правильные ответы клиенту НЕ отдаются
    return Results.Ok(new
    {
        q.Id, q.Title, q.Description, q.Category, q.Emoji, q.TimeLimit, q.Plays, q.Created,
        Questions = q.Questions.Select(x => new { x.Text, x.Options }),
        Top = PubTop(q)
    });
}));

app.MapPost("/api/quizzes", (NewQuiz n, HttpRequest req) =>
{
    var me = Auth(req);
    if (me is null) return Results.Json(new { error = "Войдите в аккаунт, чтобы создавать" }, statusCode: 401);
    var title = (n.Title ?? "").Trim();
    if (title.Length is 0 or > 300) return Bad("Введите название");
    var (qs, qerr) = Logic.ValidateQuestions(n.Questions);
    if (qerr is not null || qs is null) return Bad(qerr ?? "Неверные вопросы");
    var quiz = new Quiz
    {
        Id = Guid.NewGuid().ToString("N")[..8],
        OwnerKey = Guid.NewGuid().ToString("N"),
        OwnerUser = me.Id,
        Title = title,
        Description = Cut(n.Description, 2000),
        Category = string.IsNullOrWhiteSpace(n.Category) ? "Другое" : Cut(n.Category, 60),
        Emoji = string.IsNullOrWhiteSpace(n.Emoji) ? "" : Cut(n.Emoji, 4),
        TimeLimit = Math.Clamp(n.TimeLimit == 0 ? 20 : n.TimeLimit, 5, 120),
        Questions = qs,
        Created = DateTime.UtcNow
    };
    return db.Run(l =>
    {
        if (l.Count >= 500) return Bad("Достигнут лимит квизов на сервере");
        l.Insert(0, quiz); Log("quiz-create " + quiz.Id + " by " + me.Name);
        return Results.Json(new { id = quiz.Id, ownerKey = quiz.OwnerKey }, statusCode: 201);
    }, save: true);
}).RequireRateLimiting("write");

app.MapDelete("/api/quizzes/{id}", (string id, HttpRequest req) => db.Run(l =>
{
    var q = l.FirstOrDefault(x => x.Id == id);
    if (q is null) return NotFound();
    if (!IsAdmin(req) && req.Headers["X-Owner-Key"] != q.OwnerKey && (q.OwnerUser == "" || Auth(req)?.Id != q.OwnerUser)) return Results.Json(new { error = "Удалять может только автор" }, statusCode: 403);
    l.Remove(q); Log("quiz-delete " + id + " by " + (Auth(req)?.Name ?? "owner-key")); ThreadPool.QueueUserWorkItem(_ => SweepImgs());
    var adm = Auth(req);
    if (adm is not null && adm.Role == "admin" && adm.Id != q.OwnerUser) db.RunData(d => { Mod(d, adm, "delete-quiz", q.Title, q.Id); return 0; }); // сохранится вместе с удалением
    return Results.Ok(new { deleted = true });
}, save: true));

// ===== АККАУНТЫ: пароли только в виде PBKDF2-хеша, вход переживает перезапуск =====
var regs = new System.Collections.Concurrent.ConcurrentDictionary<string, (int n, DateTime at)>();
var fails = new System.Collections.Concurrent.ConcurrentDictionary<string, (int n, DateTime at)>();
string Sha(string s) => Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(s)));
string Pbk(string pw, string salt) => Convert.ToHexString(System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(pw, Convert.FromHexString(salt), 100_000, System.Security.Cryptography.HashAlgorithmName.SHA256, 32));
// токен берётся из HttpOnly-cookie lq_token (браузер) или из заголовка Authorization: Bearer (скрипты и API)
string TokenOf(HttpRequest req)
{
    var h = req.Headers.Authorization.FirstOrDefault() ?? "";
    if (h.StartsWith("Bearer ")) return h[7..];
    return req.Cookies["lq_token"] ?? "";
}
User? Auth(HttpRequest req)
{
    var raw = TokenOf(req);
    if (raw.Length == 0) return null;
    var th = Sha(raw);
    return db.RunData(d =>
    {
        var t = d.Tokens.FirstOrDefault(x => x.Hash == th && DateTime.UtcNow - x.At < TimeSpan.FromDays(14));
        var u = t is null ? null : d.Users.FirstOrDefault(x => x.Id == t.UserId);
        return u is null || Logic.BanActive(u.Banned, u.BanUntil, DateTime.UtcNow) ? null : u;
    });
}
IResult MakeToken(User u, HttpContext c)
{
    var tok = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
    db.RunData(d => { d.Tokens.RemoveAll(x => DateTime.UtcNow - x.At > TimeSpan.FromDays(14)); foreach (var old in d.Tokens.Where(x => x.UserId == u.Id).OrderByDescending(x => x.At).Skip(4).ToList()) d.Tokens.Remove(old); d.Tokens.Add(new Token(Sha(tok), u.Id, DateTime.UtcNow)); return 0; }, true);
    c.Response.Cookies.Append("lq_token", tok, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Strict, Secure = c.Request.IsHttps || behindCf, MaxAge = TimeSpan.FromDays(14), Path = "/" });
    return Results.Ok(new { token = tok, name = u.Name });
}

app.MapPost("/api/register", (AuthReq r, HttpContext c) =>
{
    var name = Cut(r.Name, 30); var pw = r.Password ?? "";
    if (Norm(name).Length < 2) return Bad("Имя: минимум 2 буквы или цифры");
    if (!Logic.PasswordOk(pw, name)) return Bad("Пароль: от 8 символов, буквы и цифры, не равен имени");
    var rip = ClientIp(c);
    var rc = regs.TryGetValue(rip, out var ro) && DateTime.UtcNow - ro.at < TimeSpan.FromHours(1) ? ro.n : 0;
    if (rc >= 5) return Bad("Слишком много регистраций с этого адреса. Попробуйте позже");
    regs[rip] = (rc + 1, rc == 0 ? DateTime.UtcNow : ro.at);
    var salt = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
    var u = new User { Id = Guid.NewGuid().ToString("N"), Name = name, Salt = salt, Hash = Pbk(pw, salt), Created = DateTime.UtcNow, Role = "user" };
    var added = db.RunData(d => { if (d.Users.Count >= 5000 || d.Users.Any(x => Norm(x.Name) == Norm(name))) return false; d.Users.Add(u); return true; }, true);
    if (added) Log("register " + name);
    return added ? MakeToken(u, c) : Results.Json(new { error = "Имя занято" }, statusCode: 409);
}).RequireRateLimiting("auth");

app.MapPost("/api/login", (AuthReq r, HttpContext c) =>
{
    var name = Cut(r.Name, 30); var pw = r.Password ?? "";
    var key = ClientIp(c) + "|" + Norm(name);
    if (fails.TryGetValue(key, out var f) && f.n >= 5 && DateTime.UtcNow - f.at < TimeSpan.FromMinutes(5)) return Bad("Слишком много попыток. Подождите 5 минут");
    var u = db.RunData(d => d.Users.FirstOrDefault(x => Norm(x.Name) == Norm(name)));
    var good = u is not null && pw.Length <= 200 && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(Convert.FromHexString(Pbk(pw, u.Salt)), Convert.FromHexString(u.Hash));
    if (!good)
    {
        var old = fails.TryGetValue(key, out var o) && DateTime.UtcNow - o.at < TimeSpan.FromMinutes(5) ? o.n : 0;
        fails[key] = (old + 1, DateTime.UtcNow);
        Log("login-fail " + Norm(name));
        return Bad("Неверное имя или пароль");
    }
    fails.TryRemove(key, out _);
    if (Logic.BanActive(u!.Banned, u.BanUntil, DateTime.UtcNow))
        return Results.Json(new { error = "Аккаунт заблокирован" + (u.BanUntil is null ? " навсегда" : " до " + u.BanUntil.Value.ToString("yyyy-MM-dd HH:mm") + " UTC") + (u.BanReason.Length > 0 ? ". Причина: " + u.BanReason : "") }, statusCode: 403);
    return MakeToken(u, c);
}).RequireRateLimiting("auth");

app.MapPost("/api/logout", (HttpRequest req) =>
{
    var raw = TokenOf(req);
    if (raw.Length > 0) { var th = Sha(raw); db.RunData(d => d.Tokens.RemoveAll(x => x.Hash == th), true); }
    req.HttpContext.Response.Cookies.Delete("lq_token", new CookieOptions { Path = "/" });
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/me", (HttpRequest req) =>
{
    var u = Auth(req);
    if (u is null) return Results.Json(new { error = "Не авторизован" }, statusCode: 401);
    return Results.Ok(new
    {
        name = u.Name,
        admin = IsAdmin(req),
        quizzes = db.Run(l => l.Where(x => x.OwnerUser == u.Id).Select(x => new { id = x.Id, title = x.Title }).ToList()),
        boards = db.RunBoards(l => l.Where(x => x.OwnerUser == u.Id).Select(x => new { id = x.Id, title = x.Title }).ToList())
    });
});

// ===== ЗАГРУЗКА ФОТО, ИЗМЕНЕНИЕ КВИЗА, СМЕНА ПАРОЛЯ =====
app.MapPost("/api/upload", (UploadReq r, HttpRequest req) =>
{
    var me = Auth(req);
    if (me is null) return Results.Json(new { error = "Войдите в аккаунт" }, statusCode: 401);
    const string pre = "data:image/jpeg;base64,";
    if (r.Data is null || !r.Data.StartsWith(pre) || r.Data.Length > 1_200_000) return Bad("Нужна картинка JPEG до 800 КБ");
    byte[] b;
    try { b = Convert.FromBase64String(r.Data[pre.Length..]); } catch { return Bad("Битая картинка"); }
    byte[] clean;
    try
    {
        var fmt = Image.DetectFormat(b);                       // реальный формат по содержимому, а не по первым байтам
        if (fmt is null || fmt.DefaultMimeType != "image/jpeg") return Bad("Это не JPEG");
        var info = Image.Identify(b);                          // размеры без полной распаковки
        if (info.Width < 16 || info.Height < 16 || info.Width > 4000 || info.Height > 4000) return Bad("Размер фото: от 16 до 4000 пикселей");
        using var img = Image.Load(b);
        if (Math.Max(img.Width, img.Height) > 1280) img.Mutate(x => x.Resize(new ResizeOptions { Size = new Size(1280, 1280), Mode = ResizeMode.Max }));
        img.Metadata.ExifProfile = null;                       // геометки и прочие метаданные не храним
        using var ms = new MemoryStream();
        img.SaveAsJpeg(ms, new JpegEncoder { Quality = 82 });  // пересохраняем на сервере
        clean = ms.ToArray();
    }
    catch { return Bad("Не удалось прочитать изображение"); }
    if (clean.Length > 600_000) return Bad("Фото после обработки больше 600 КБ");
    var name = Guid.NewGuid().ToString("N") + ".jpg";
    var okQuota = db.RunData(d =>
    {
        if (d.Images.Count(x => x.UserId == me.Id) >= 100) return false;   // не больше 100 фото на пользователя
        d.Images.Add(new ImgRec(name, me.Id, DateTime.UtcNow)); return true;
    }, true);
    if (!okQuota) return Bad("Достигнут лимит: 100 фото на аккаунт. Удалите ненужные квизы");
    File.WriteAllBytes(Path.Combine(imgDir, name), clean);
    return Results.Ok(new { url = "/img/" + name });
}).RequireRateLimiting("upload");

app.MapPut("/api/quizzes/{id}", (string id, EditQuiz e, HttpRequest req) =>
{
    var me = Auth(req);
    if (me is null) return Results.Json(new { error = "Войдите в аккаунт" }, statusCode: 401);
    var t = (e.Title ?? "").Trim();
    if (t.Length is 0 or > 300) return Bad("Введите название");
    List<Question>? newQs = null;
    if (e.Questions is not null) // вопросы можно менять целиком: добавлять, удалять, править варианты и фото
    {
        var (vq, verr) = Logic.ValidateQuestions(e.Questions);
        if (verr is not null || vq is null) return Bad(verr ?? "Неверные вопросы");
        newQs = vq;
    }
    return db.Run(l =>
    {
        var q = l.FirstOrDefault(x => x.Id == id);
        if (q is null) return NotFound();
        if (q.OwnerUser != me.Id && !IsAdmin(req)) return Results.Json(new { error = "Изменять может только автор" }, statusCode: 403);
        q.Title = t; q.Description = Cut(e.Description, 2000);
        if (!string.IsNullOrWhiteSpace(e.Category)) q.Category = Cut(e.Category, 60);
        if (e.TimeLimit != 0) q.TimeLimit = Math.Clamp(e.TimeLimit, 5, 120);
        if (newQs is not null) { q.Questions = newQs; ThreadPool.QueueUserWorkItem(_ => SweepImgs()); } // убранные фото удалятся с диска
        Log("quiz-edit " + id + " by " + me.Name + (newQs is not null ? " (вопросы изменены)" : ""));
        return Results.Ok(new { updated = true });
    }, save: true);
});

// квиз вместе с правильными ответами: только автору и админу (нужен редактору)
app.MapGet("/api/quizzes/{id}/edit", (string id, HttpRequest req) =>
{
    var me = Auth(req);
    if (me is null) return Results.Json(new { error = "Войдите в аккаунт" }, statusCode: 401);
    return db.Run(l =>
    {
        var q = l.FirstOrDefault(x => x.Id == id);
        if (q is null) return NotFound();
        if (q.OwnerUser != me.Id && !IsAdmin(req)) return Results.Json(new { error = "Изменять может только автор" }, statusCode: 403);
        return Results.Ok(new { q.Id, q.Title, q.Description, q.Category, q.TimeLimit, Questions = q.Questions });
    });
});

app.MapPost("/api/password", (PassReq r, HttpRequest req) =>
{
    var u = Auth(req);
    if (u is null) return Results.Json(new { error = "Не авторизован" }, statusCode: 401);
    var np = r.NewPassword ?? "";
    if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(Convert.FromHexString(Pbk(r.OldPassword ?? "", u.Salt)), Convert.FromHexString(u.Hash))) return Bad("Старый пароль неверный");
    if (np.Length < 8 || np.Length > 200 || !np.Any(char.IsLetter) || !np.Any(char.IsDigit)) return Bad("Новый пароль: от 8 символов, буквы и цифры");
    var keep = Sha(TokenOf(req));
    db.RunData(d => { u.Salt = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16)); u.Hash = Pbk(np, u.Salt); d.Tokens.RemoveAll(x => x.UserId == u.Id && x.Hash != keep); return 0; }, true);
    Log("password-change " + u.Name);
    return Results.Ok(new { ok = true });
}).RequireRateLimiting("auth");

// ===== ИГРА ЧЕРЕЗ СЕРВЕРНУЮ СЕССИЮ: порядок, время и очки считает только сервер =====
var sess = new System.Collections.Concurrent.ConcurrentDictionary<string, Sess>();

// ===== АДМИН: кто играет сейчас и «скример». Роль admin: по секретному коду LARP_ADMIN_CODE или от другого админа =====
bool IsAdmin(HttpRequest req) { var u = Auth(req); return u is not null && u.Role == "admin"; }
app.MapGet("/api/admin/players", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Results.Json(new { error = "Только для админа" }, statusCode: 403);
    var titles = db.Run(l => l.ToDictionary(q => q.Id, q => q.Title));
    return Results.Ok(sess.Select(kv => new { sid = kv.Key, name = kv.Value.Name, quiz = titles.GetValueOrDefault(kv.Value.QuizId, "?"), done = kv.Value.N, total = kv.Value.Order.Length, points = kv.Value.Pts }).OrderBy(x => x.name).ToList());
});
app.MapPost("/api/admin/scream", (ScareReq r, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Results.Json(new { error = "Только для админа" }, statusCode: 403);
    var n = 0;
    foreach (var kv in sess) if (r.Sid is null or "" or "all" || kv.Key == r.Sid) { kv.Value.Scare = true; n++; }
    Log("scream " + (r.Sid ?? "all") + " n=" + n);
    return Results.Ok(new { sent = n });
});
app.MapGet("/api/play/{sid}/ping", (string sid) =>
{
    if (!sess.TryGetValue(sid, out var s)) return Gone("Сессия истекла");
    var sc = s.Scare; s.Scare = false;
    return Results.Ok(new { scare = sc });
}).RequireRateLimiting("game");

app.MapPost("/api/quizzes/{id}/start", (string id, StartReq r, HttpRequest req) =>
{
    foreach (var kv in sess) if (DateTime.UtcNow - kv.Value.Seen > TimeSpan.FromMinutes(30) || DateTime.UtcNow - kv.Value.Started > TimeSpan.FromHours(2)) sess.TryRemove(kv.Key, out _);
    if (sess.Count > 3000) return Bad("Сервер занят, попробуйте позже");
    return db.Run(l =>
    {
        var q = l.FirstOrDefault(x => x.Id == id);
        if (q is null) return NotFound();
        var name = Cut(r.Name, 40); if (name.Length == 0) name = "Игрок";
        var ip = ClientIp(req.HttpContext);
        var me = Auth(req);
        if (me is not null) foreach (var kv in sess) if (kv.Value.UserId == me.Id && kv.Value.QuizId == id) sess.TryRemove(kv.Key, out _); // новая игра заменяет старую того же квиза
        if (sess.Values.Count(x => x.Ip == ip) >= 8) return Bad("Слишком много активных игр с этого адреса. Завершите предыдущие");
        if (me is not null && sess.Values.Count(x => x.UserId == me.Id) >= 3) return Bad("Не больше 3 одновременных игр на аккаунт");
        if (me is not null) name = me.Name;
        else if (db.RunData(d => d.Users.Any(u => Norm(u.Name) == Norm(name)))) return Bad("Это имя занято зарегистрированным игроком. Войдите или выберите другое");
        var mode = r.Mode is "survival" or "practice" ? r.Mode : "classic";
        var s = new Sess { QuizId = id, Name = name, UserId = me?.Id ?? "", Ip = ip, Qs = q.Questions.ToList(), Limit = q.TimeLimit, Mode = mode, Lives = mode == "survival" ? 3 : 0, Hints = 2, Order = Enumerable.Range(0, q.Questions.Count).OrderBy(_ => Random.Shared.Next()).ToArray() };
        s.Perm = s.Order.Select(i => Enumerable.Range(0, q.Questions[i].Options.Length).OrderBy(_ => Random.Shared.Next()).ToArray()).ToArray();
        var sid = Guid.NewGuid().ToString("N"); sess[sid] = s;
        return Results.Ok(new { sid, total = s.Order.Length, mode, lives = s.Lives, hints = s.Hints });
    });
}).RequireRateLimiting("game");

app.MapPost("/api/play/{sid}/question", (string sid) =>
{
    if (!sess.TryGetValue(sid, out var s)) return Gone("Сессия истекла");
    lock (s)
    {
        if (s.N >= s.Order.Length || s.Over) return Bad("Игра окончена");
        s.Seen = DateTime.UtcNow; s.ServedAt ??= DateTime.UtcNow; // обновление страницы таймер не сбрасывает
        var qu = s.Qs[s.Order[s.N]];
        var left = Math.Max(0, s.Limit * 1000 - (int)(DateTime.UtcNow - s.ServedAt.Value).TotalMilliseconds);
        return Results.Ok(new { n = s.N, mode = s.Mode, lives = s.Lives, hints = s.Hints, hidden = s.HintThis ? s.Hidden ?? Array.Empty<int>() : Array.Empty<int>(), text = qu.Text, image = qu.Image, optImages = s.Perm[s.N].Select(k => qu.OptImages?[k] ?? "").ToList(), options = s.Perm[s.N].Select(k => qu.Options[k]).ToList(), leftMs = left });
    }
}).RequireRateLimiting("game");

// Подсказка 50/50: сервер сам убирает неверные варианты (2 подсказки на игру, одна на вопрос)
app.MapPost("/api/play/{sid}/hint", (string sid) =>
{
    if (!sess.TryGetValue(sid, out var s)) return Gone("Сессия истекла");
    lock (s)
    {
        if (s.N >= s.Order.Length || s.Over || s.ServedAt is null) return Bad("Нет активного вопроса");
        if (s.HintThis) return Bad("В этом вопросе подсказка уже использована");
        if (s.Hints <= 0) return Bad("Подсказки закончились");
        var qu = s.Qs[s.Order[s.N]]; var perm = s.Perm[s.N];
        var hide = Logic.PickHidden(perm, qu.Correct);
        if (hide.Length == 0) return Bad("В этом вопросе подсказка не нужна");
        s.Hints--; s.HintThis = true; s.Hidden = hide;
        return Results.Ok(new { hide, hints = s.Hints });
    }
}).RequireRateLimiting("game");

app.MapPost("/api/play/{sid}/answer", (string sid, PickReq a) =>
{
    if (!sess.TryGetValue(sid, out var s)) return Gone("Сессия истекла");
    lock (s)
    {
        if (s.N >= s.Order.Length || s.Over || s.ServedAt is null) return Bad("Нет активного вопроса");
        var qu = s.Qs[s.Order[s.N]]; var perm = s.Perm[s.N];
        s.Seen = DateTime.UtcNow;
        var ms = (int)(DateTime.UtcNow - s.ServedAt.Value).TotalMilliseconds;
        var ok = (s.Mode == "practice" || ms <= s.Limit * 1000 + grace) && a.Choice >= 0 && a.Choice < perm.Length && perm[a.Choice] == qu.Correct;
        var pts = Points(ok, ms, s.Limit);
        pts = Logic.HintPoints(pts, s.HintThis); // подсказка 50/50 вдвое режет очки за вопрос
        s.Pts += pts; if (ok) s.Ok++; s.N++; s.ServedAt = null; s.HintThis = false; s.Hidden = null;
        s.Lives = Logic.LivesAfter(s.Mode, s.Lives, ok); if (s.Mode == "survival" && s.Lives <= 0 && !ok) s.Over = true;
        return Results.Ok(new { correct = ok, correctPos = Array.IndexOf(perm, qu.Correct), points = pts, total = s.Pts, done = s.N >= s.Order.Length || s.Over, lives = s.Lives, explain = qu.Explain ?? "" });
    }
}).RequireRateLimiting("game");

app.MapPost("/api/play/{sid}/finish", (string sid) =>
{
    if (!sess.TryGetValue(sid, out var s)) return Gone("Сессия истекла");
    return db.Run(l =>
    {
        var q = l.FirstOrDefault(x => x.Id == s.QuizId);
        if (q is null) { sess.TryRemove(sid, out _); return Results.Ok(new { points = s.Pts, correct = s.Ok, total = s.Order.Length, rank = 0, top = new List<object>() }); }
        lock (s) { if (s.N < s.Order.Length && !s.Over) return Bad("Не все вопросы пройдены"); }
        if (!sess.TryRemove(sid, out _)) return Bad("Результат уже сохранён");
        if (s.UserId != "") db.RunData(d => { d.Plays.Add(new PlayRec(s.UserId, q.Id, q.Title, q.Category, s.Mode, s.Pts, s.Ok, s.N, DateTime.UtcNow)); if (d.Plays.Count > 20000) d.Plays.RemoveRange(0, d.Plays.Count - 20000); return 0; });
        if (s.Mode != "classic") return Results.Ok(new { points = s.Pts, correct = s.Ok, total = s.Order.Length, answered = s.N, rank = 0, top = PubTop(q) }); // выживание и тренировка вне рейтинга
        q.Plays++;
        var ex = q.Scores.FirstOrDefault(x => s.UserId != "" ? x.UserId == s.UserId : x.UserId == "" && x.Name.Equals(s.Name, StringComparison.OrdinalIgnoreCase));
        if (ex is null || s.Pts > ex.Points) { if (ex is not null) q.Scores.Remove(ex); q.Scores.Add(new Score(s.Name, s.Pts, s.Ok, DateTime.UtcNow, s.UserId)); }
        q.Scores = q.Scores.OrderByDescending(x => x.Points).Take(100).ToList();
        var rank = q.Scores.Count(x => x.Points > s.Pts) + 1;
        return Results.Ok(new { points = s.Pts, correct = s.Ok, total = s.Order.Length, answered = s.N, rank, top = PubTop(q) });
    }, save: true);
}).RequireRateLimiting("game");

// =====================  СВОЯ ИГРА (доска с командами)  =====================
app.MapGet("/api/boards", () => db.RunBoards(l => l.OrderByDescending(b => b.Created).Select(b => new
{
    b.Id, b.Title, b.Created,
    Categories = b.Categories.Select(c => c.Name),
    Count = b.Categories.Sum(c => c.Cells.Count)
}).ToList()));

app.MapGet("/api/boards/random", () => db.RunBoards(l => l.Count == 0 ? NotFound() : Results.Ok(new { id = l[Random.Shared.Next(l.Count)].Id })));
app.MapGet("/api/boards/{id}", (string id) => db.RunBoards(l =>
{
    var b = l.FirstOrDefault(x => x.Id == id);
    return b is null ? NotFound() : Results.Ok(new { b.Id, b.Title, b.Created, Categories = b.Categories.Select(c => new { c.Name, Cells = c.Cells.Select(x => new { x.Points }) }) });
}));

app.MapPost("/api/boards", (NewBoard n, HttpRequest req) =>
{
    var me = Auth(req);
    if (me is null) return Results.Json(new { error = "Войдите в аккаунт, чтобы создавать" }, statusCode: 401);
    var title = (n.Title ?? "").Trim();
    if (title.Length is 0 or > 300) return Bad("Введите название");
    if (n.Categories is null || n.Categories.Count is < 1 or > 12) return Bad("Нужно от 1 до 12 категорий");
    var cats = new List<BoardCat>(); var seenCat = new HashSet<string>(); var seenBQ = new HashSet<string>();
    foreach (var c in n.Categories)
    {
        var name = Cut(c.Name, 200);
        if (name.Length == 0) return Bad("У каждой категории должно быть название");
        if (!seenCat.Add(Norm(name))) return Bad($"Категория «{name}» повторяется");
        if (c.Cells is null || c.Cells.Count is < 1 or > 20) return Bad($"Категория «{name}»: от 1 до 20 вопросов");
        if (c.Cells.Select(x => x.Points).Distinct().Count() != c.Cells.Count) return Bad($"Категория «{name}»: стоимость вопросов не должна повторяться");
        var cells = new List<Cell>(); var seenA = new HashSet<string>();
        foreach (var x in c.Cells)
        {
            var q = Cut(x.Question, 5000); var a = Cut(x.Answer, 5000);
            if (!seenBQ.Add(Norm(q))) return Bad($"Вопрос «{Cut(q, 40)}» повторяется");
            if (!seenA.Add(Norm(a))) return Bad($"Категория «{name}»: ответ «{Cut(a, 40)}» повторяется");
            if (x.Points is < 1 or > 10000) return Bad("Стоимость вопроса: от 1 до 10000");
            if (q.Length == 0 || a.Length == 0) return Bad($"Категория «{name}»: заполните вопрос и ответ у каждой ячейки");
            cells.Add(new Cell(x.Points, q, a));
        }
        cats.Add(new BoardCat(name, cells.OrderBy(x => x.Points).ToList()));
    }
    var board = new Board { Id = Guid.NewGuid().ToString("N")[..8], OwnerKey = Guid.NewGuid().ToString("N"), OwnerUser = me.Id, Title = title, Categories = cats, Created = DateTime.UtcNow };
    return db.RunBoards(l =>
    {
        if (l.Count >= 300) return Bad("Достигнут лимит игр на сервере");
        l.Insert(0, board); Log("board-create " + board.Id + " by " + me.Name);
        return Results.Json(new { id = board.Id, ownerKey = board.OwnerKey }, statusCode: 201);
    }, save: true);
}).RequireRateLimiting("write");

// ===== ВЕДУЩИЙ: вопрос отдаётся при открытии ячейки, ответ только после открытия вопроса =====
var hosts = new System.Collections.Concurrent.ConcurrentDictionary<string, HostS>();
app.MapPost("/api/boards/{id}/host", (string id, HttpRequest req) =>
{
    var me = Auth(req);
    if (me is null) return Results.Json(new { error = "Чтобы вести игру, войдите в аккаунт" }, statusCode: 401);
    foreach (var kv in hosts) if (DateTime.UtcNow - kv.Value.Started > TimeSpan.FromHours(12)) hosts.TryRemove(kv.Key, out _);
    if (hosts.Count > 2000) return Bad("Сервер занят");
    if (!db.RunBoards(l => l.Any(x => x.Id == id))) return NotFound();
    var hid = Guid.NewGuid().ToString("N"); hosts[hid] = new HostS { BoardId = id, UserId = me.Id };
    return Results.Ok(new { hid });
});
Cell? FindCell(string bid, int ci, int pts) => db.RunBoards(l => l.FirstOrDefault(x => x.Id == bid)?.Categories.ElementAtOrDefault(ci)?.Cells.FirstOrDefault(z => z.Points == pts));
app.MapPost("/api/host/{hid}/open", (string hid, CellReq r, HttpRequest req) =>
{
    if (!hosts.TryGetValue(hid, out var h)) return Gone("Сессия ведущего истекла");
    if (Auth(req)?.Id != h.UserId) return Results.Json(new { error = "Это не ваша сессия ведущего" }, statusCode: 403);
    var c = FindCell(h.BoardId, r.Ci, r.P); if (c is null) return NotFound();
    lock (h) h.Opened.Add(r.Ci + "-" + r.P);
    return Results.Ok(new { question = c.Question });
});
app.MapPost("/api/host/{hid}/reveal", (string hid, CellReq r, HttpRequest req) =>
{
    if (!hosts.TryGetValue(hid, out var h)) return Gone("Сессия ведущего истекла");
    if (Auth(req)?.Id != h.UserId) return Results.Json(new { error = "Это не ваша сессия ведущего" }, statusCode: 403);
    bool opened; lock (h) opened = h.Opened.Contains(r.Ci + "-" + r.P);
    if (!opened) return Bad("Сначала откройте вопрос");
    var c = FindCell(h.BoardId, r.Ci, r.P); if (c is null) return NotFound();
    return Results.Ok(new { answer = c.Answer });
});

app.MapDelete("/api/boards/{id}", (string id, HttpRequest req) => db.RunBoards(l =>
{
    var b = l.FirstOrDefault(x => x.Id == id);
    if (b is null) return NotFound();
    if (!IsAdmin(req) && req.Headers["X-Owner-Key"] != b.OwnerKey && (b.OwnerUser == "" || Auth(req)?.Id != b.OwnerUser)) return Results.Json(new { error = "Удалять может только автор" }, statusCode: 403);
    l.Remove(b); Log("board-delete " + id);
    var adm = Auth(req);
    if (adm is not null && adm.Role == "admin" && adm.Id != b.OwnerUser) db.RunData(d => { Mod(d, adm, "delete-board", b.Title, b.Id); return 0; }); // сохранится вместе с удалением
    return Results.Ok(new { deleted = true });
}, save: true));

// =====================  ПРОФИЛЬ, РЕЙТИНГ, ЖАЛОБЫ, МОДЕРАЦИЯ  =====================
IResult Unauth() => Results.Json(new { error = "Войдите в аккаунт" }, statusCode: 401);
IResult Forbid() => Results.Json(new { error = "Только для админа" }, statusCode: 403);

app.MapGet("/api/profile", (HttpRequest req) =>
{
    var me = Auth(req); if (me is null) return Unauth();
    var plays = db.RunData(d => d.Plays.Where(x => x.UserId == me.Id).OrderByDescending(x => x.At).ToList());
    var qs = plays.Sum(x => x.Total);
    var ok = plays.Sum(x => x.Correct);
    var classic = plays.Where(x => x.Mode == "classic").ToList();
    return Results.Ok(new
    {
        name = me.Name, created = me.Created, admin = me.Role == "admin",
        games = plays.Count, questions = qs, correct = ok, accuracy = qs == 0 ? 0 : (int)Math.Round(100.0 * ok / qs),
        points = classic.Sum(x => x.Points), best = classic.Count == 0 ? 0 : classic.Max(x => x.Points),
        byCategory = plays.GroupBy(x => x.Category).Select(g => new { category = g.Key, games = g.Count(), accuracy = g.Sum(x => x.Total) == 0 ? 0 : (int)Math.Round(100.0 * g.Sum(x => x.Correct) / g.Sum(x => x.Total)) }).OrderByDescending(x => x.games).ToList(),
        history = plays.Take(30).Select(x => new { quizId = x.QuizId, title = x.Title, category = x.Category, mode = x.Mode, points = x.Points, correct = x.Correct, total = x.Total, at = x.At }).ToList()
    });
});

// глобальный рейтинг: сумма лучших результатов игрока по каждому квизу (только режим «Классика»)
app.MapGet("/api/leaderboard", (string? period, string? category) =>
{
    var from = period == "week" ? DateTime.UtcNow.AddDays(-7) : period == "month" ? DateTime.UtcNow.AddDays(-30) : DateTime.MinValue;
    var names = db.RunData(d => d.Users.ToDictionary(u => u.Id, u => u.Name));
    var rows = db.RunData(d => d.Plays.Where(x => x.Mode == "classic" && x.At >= from && (string.IsNullOrEmpty(category) || x.Category == category)).ToList());
    var top = rows.GroupBy(x => x.UserId).Select(g =>
    {
        var best = g.GroupBy(x => x.QuizId).Select(z => z.OrderByDescending(x => x.Points).First()).ToList();
        var tq = g.Sum(x => x.Total);
        return new { name = names.GetValueOrDefault(g.Key, "?"), points = best.Sum(x => x.Points), quizzes = best.Count, games = g.Count(), accuracy = tq == 0 ? 0 : (int)Math.Round(100.0 * g.Sum(x => x.Correct) / tq) };
    }).OrderByDescending(x => x.points).Take(50).ToList();
    return Results.Ok(top);
});

app.MapPost("/api/quizzes/{id}/report", (string id, ReportReq r, HttpRequest req) =>
{
    var me = Auth(req); if (me is null) return Unauth();
    var reason = Cut(r.Reason, 500); if (reason.Length < 3) return Bad("Опишите, что не так (от 3 символов)");
    if (!db.Run(l => l.Any(x => x.Id == id))) return NotFound();
    var added = db.RunData(d =>
    {
        if (d.Reports.Any(x => x.QuizId == id && x.UserId == me.Id && x.Open)) return false;
        if (d.Reports.Count > 2000) return false;
        d.Reports.Add(new Report { Id = Guid.NewGuid().ToString("N")[..8], QuizId = id, UserId = me.Id, Reason = reason, At = DateTime.UtcNow, Open = true }); return true;
    }, true);
    return added ? Results.Ok(new { ok = true }) : Bad("Вы уже отправили жалобу на этот квиз");
}).RequireRateLimiting("write");

app.MapGet("/api/admin/reports", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Forbid();
    var names = db.RunData(d => d.Users.ToDictionary(u => u.Id, u => u.Name));
    var titles = db.Run(l => l.ToDictionary(q => q.Id, q => q.Title));
    return Results.Ok(db.RunData(d => d.Reports.Where(x => x.Open).OrderByDescending(x => x.At).Select(x => new { x.Id, x.QuizId, quiz = titles.GetValueOrDefault(x.QuizId, "(удалён)"), user = names.GetValueOrDefault(x.UserId, "?"), x.Reason, x.At }).ToList()));
});
app.MapPost("/api/admin/reports/{rid}/close", (string rid, HttpRequest req) =>
{
    var me = Auth(req); if (me is null || me.Role != "admin") return Forbid();
    db.RunData(d => { var x = d.Reports.FirstOrDefault(z => z.Id == rid); if (x is not null) { x.Open = false; Mod(d, me, "report-close", x.QuizId, x.Reason); } return 0; }, true);
    Log("report-close " + rid + " by " + me.Name);
    return Results.Ok(new { ok = true });
});
app.MapGet("/api/admin/users", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Forbid();
    return Results.Ok(db.RunData(d => { var now = DateTime.UtcNow; return d.Users.OrderByDescending(u => u.Created).Take(200).Select(u => new { u.Name, u.Role, Banned = Logic.BanActive(u.Banned, u.BanUntil, now), u.BanUntil, u.BanReason, u.Created }).ToList(); }));
});
app.MapPost("/api/admin/ban", (BanReq r, HttpRequest req) =>
{
    var me = Auth(req); if (me is null || me.Role != "admin") return Forbid();
    var reason = Cut(r.Reason, 200);
    if (r.Banned && reason.Length < 3) return Bad("Укажите причину блокировки (от 3 символов)");
    var hours = Math.Clamp(r.Hours, 0, 24 * 365); // 0 = навсегда
    var ok = db.RunData(d =>
    {
        var u = d.Users.FirstOrDefault(x => Norm(x.Name) == Norm(r.Name ?? ""));
        if (u is null || u.Id == me.Id || u.Role == "admin") return false;
        if (r.Banned)
        {
            u.Banned = true; u.BanUntil = hours > 0 ? DateTime.UtcNow.AddHours(hours) : (DateTime?)null; u.BanReason = reason;
            d.Tokens.RemoveAll(t => t.UserId == u.Id);
            Mod(d, me, "ban", u.Name, (hours > 0 ? hours + " ч. " : "навсегда ") + reason);
        }
        else { u.Banned = false; u.BanUntil = null; u.BanReason = ""; Mod(d, me, "unban", u.Name, ""); }
        return true;
    }, true);
    if (ok) Log("ban " + r.Name + "=" + r.Banned + " by " + me.Name);
    return ok ? Results.Ok(new { ok = true }) : Bad("Пользователь не найден (админов блокировать нельзя)");
});
app.MapPost("/api/admin/role", (RoleReq r, HttpRequest req) =>
{
    var me = Auth(req); if (me is null || me.Role != "admin") return Forbid();
    if (r.Role is not ("admin" or "user")) return Bad("Роль: admin или user");
    var ok = db.RunData(d =>
    {
        var u = d.Users.FirstOrDefault(x => Norm(x.Name) == Norm(r.Name ?? ""));
        if (u is null || u.Id == me.Id) return false;
        u.Role = r.Role; Mod(d, me, "role", u.Name, r.Role); return true;
    }, true);
    if (ok) Log("role " + r.Name + "=" + r.Role + " by " + me.Name);
    return ok ? Results.Ok(new { ok = true }) : Bad("Пользователь не найден (себе роль менять нельзя)");
});
// Первый админ: пользователь с аккаунтом вводит секретный код из переменной окружения LARP_ADMIN_CODE (не короче 12 символов)
var adminCode = Environment.GetEnvironmentVariable("LARP_ADMIN_CODE") ?? "";
app.MapPost("/api/admin/claim", (ClaimReq r, HttpRequest req) =>
{
    var me = Auth(req); if (me is null) return Unauth();
    if (adminCode.Length < 12) return Results.Json(new { error = "Выдача админа по коду отключена на сервере" }, statusCode: 403);
    var same = System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(Convert.FromHexString(Sha(r.Code ?? "")), Convert.FromHexString(Sha(adminCode)));
    if (!same) { Log("admin-claim-fail " + me.Name); return Bad("Неверный код"); }
    db.RunData(d => { var u = d.Users.FirstOrDefault(x => x.Id == me.Id); if (u is not null && u.Role != "admin") { u.Role = "admin"; Mod(d, u, "claim-admin", u.Name, "по коду"); } return 0; }, true);
    Log("admin-claim " + me.Name);
    return Results.Ok(new { ok = true });
}).RequireRateLimiting("auth");

// структурированная история действий модераторов (кто, что, над чем, когда)
app.MapGet("/api/admin/modlog", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Forbid();
    return Results.Ok(db.RunData(d => d.ModLog.OrderByDescending(x => x.At).Take(100).ToList()));
});

// проверка работоспособности для мониторинга (без личных данных)
app.MapGet("/health", () => Results.Ok(new { status = "ok", quizzes = db.Run(l => l.Count), boards = db.RunBoards(l => l.Count), activeGames = sess.Count, utc = DateTime.UtcNow }));

app.MapGet("/api/admin/log", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Forbid();
    try { lock (logLock) return Results.Ok(new { lines = File.ReadLines(Path.Combine(app.Environment.ContentRootPath, "data", "app.log")).TakeLast(100).Reverse().ToList() }); }
    catch { return Results.Ok(new { lines = new List<string>() }); }
});

// уборка: устаревшие записи ограничителей, сессии, токены, неиспользуемые фото
var janitor = new Timer(state =>
{
    try
    {
        var now = DateTime.UtcNow;
        foreach (var kv in regs) if (now - kv.Value.at > TimeSpan.FromHours(1)) regs.TryRemove(kv.Key, out _);
        foreach (var kv in fails) if (now - kv.Value.at > TimeSpan.FromMinutes(5)) fails.TryRemove(kv.Key, out _);
        foreach (var kv in sess) if (now - kv.Value.Seen > TimeSpan.FromMinutes(30) || now - kv.Value.Started > TimeSpan.FromHours(2)) sess.TryRemove(kv.Key, out _);
        foreach (var kv in hosts) if (now - kv.Value.Started > TimeSpan.FromHours(12)) hosts.TryRemove(kv.Key, out _);
        db.RunData(d => { d.Tokens.RemoveAll(x => now - x.At > TimeSpan.FromDays(14)); return 0; }, true);
        SweepImgs();
    }
    catch (Exception e) { Log("janitor " + e.Message); }
}, null, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(10));

app.Run(Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://0.0.0.0:5000");
GC.KeepAlive(janitor);
