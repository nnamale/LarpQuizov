using System.Text.RegularExpressions;

// Чистая игровая логика без доступа к серверу и файлам: именно её проверяют автотесты (LarpQuizov.Tests)
public static class Logic
{
    public static string Cut(string? s, int max) { s = (s ?? "").Trim(); return s.Length > max ? s[..max] : s; }

    public static string Norm(string? s) =>
        string.Join(" ", new string((s ?? "").ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : ' ').ToArray())
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public static bool ImgOk(string? s) => string.IsNullOrEmpty(s) || Regex.IsMatch(s, @"^/img/[0-9a-f]{32}\.jpg$");

    // 50..100 очков за верный ответ: чем быстрее, тем больше. Неверный ответ = 0
    public static int Points(bool ok, int ms, int limit) =>
        ok ? (int)(50 + 50 * (1 - Math.Clamp(ms, 0, limit * 1000) / (double)(limit * 1000))) : 0;

    // подсказка 50/50 вдвое режет очки за вопрос
    public static int HintPoints(int pts, bool hintUsed) => hintUsed ? pts / 2 : pts;

    // подсказка прячет половину неверных вариантов; perm[k] = индекс исходного варианта на позиции k
    public static int[] PickHidden(int[] perm, int correct, Random? rnd = null)
    {
        rnd ??= Random.Shared;
        return Enumerable.Range(0, perm.Length).Where(k => perm[k] != correct).OrderBy(_ => rnd.Next()).Take(perm.Length / 2).ToArray();
    }

    // блокировка действует, пока не истёк срок (until = null означает «навсегда»)
    public static bool BanActive(bool banned, DateTime? until, DateTime now) => banned && (until is null || until > now);

    // пароль: 8-200 символов, есть буква и цифра, не совпадает с именем
    public static bool PasswordOk(string? pw, string? name)
    {
        pw ??= "";
        return pw.Length >= 8 && pw.Length <= 200 && pw.Any(char.IsLetter) && pw.Any(char.IsDigit) && Norm(pw) != Norm(name);
    }

    // проверка и очистка вопросов квиза (общая для создания и редактирования); при ошибке возвращает текст ошибки
    internal static (List<Question>? Questions, string? Error) ValidateQuestions(List<Question>? input)
    {
        if (input is null || input.Count is < 1 or > 300) return (null, "Нужно от 1 до 300 вопросов");
        var qs = new List<Question>(); var seenQ = new HashSet<string>();
        foreach (var q in input)
        {
            var text = (q.Text ?? "").Trim();
            var opts = (q.Options ?? Array.Empty<string>()).Select(o => (o ?? "").Trim()).ToArray();
            if ((text.Length == 0 && string.IsNullOrEmpty(q.Image)) || text.Length > 5000) return (null, "Введите текст вопроса или добавьте фото");
            if (!ImgOk(q.Image) || (q.OptImages?.Any(x => !ImgOk(x)) ?? false) || (q.OptImages is not null && q.OptImages.Length != opts.Length)) return (null, "Неверная картинка");
            if (opts.Length is < 2 or > 4 || opts.Select((o, i) => o.Length > 1000 || (o.Length == 0 && string.IsNullOrEmpty(q.OptImages?.ElementAtOrDefault(i)))).Any(x => x)) return (null, "У вопроса должно быть от 2 до 4 непустых вариантов");
            if (q.Correct < 0 || q.Correct >= opts.Length) return (null, "Не выбран правильный ответ");
            if (opts.Select((o, i) => Norm(o) + "|" + (q.OptImages?.ElementAtOrDefault(i) ?? "")).Distinct().Count() != opts.Length) return (null, $"Вопрос «{Cut(text, 40)}»: варианты ответа повторяются");
            if (!seenQ.Add(Norm(text) + "|" + q.Image)) return (null, $"Вопрос «{Cut(text, 40)}» повторяется");
            qs.Add(new Question(text, opts, q.Correct, q.Image ?? "", q.OptImages?.Select(x => x ?? "").ToArray(), Cut(q.Explain, 400)));
        }
        return (qs, null);
    }

    // выживание: ошибка забирает жизнь, в других режимах жизни не меняются
    public static int LivesAfter(string mode, int lives, bool ok) => mode == "survival" && !ok ? lives - 1 : lives;
}
