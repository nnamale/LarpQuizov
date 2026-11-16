// ---------- модели ----------
record Question(string Text, string[] Options, int Correct, string Image = "", string[]? OptImages = null, string? Explain = null);
record UploadReq(string? Data);
record EditQuiz(string? Title, string? Description, string? Category = null, int TimeLimit = 0, List<Question>? Questions = null);
record PassReq(string? OldPassword, string? NewPassword);
record Score(string Name, int Points, int Correct, DateTime At, string UserId = "");
record NewQuiz(string? Title, string? Description, string? Category, string? Emoji, int TimeLimit, List<Question>? Questions);
record StartReq(string? Name, string? Mode = null);
record ScareReq(string? Sid);
record CellReq(int Ci, int P);
class HostS { public string BoardId = "", UserId = ""; public HashSet<string> Opened = new(); public DateTime Started = DateTime.UtcNow; }
record AuthReq(string? Name, string? Password);
record Token(string Hash, string UserId, DateTime At);
class User { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Salt { get; set; } = ""; public string Hash { get; set; } = ""; public DateTime Created { get; set; } public string Role { get; set; } = "user"; public bool Banned { get; set; } public DateTime? BanUntil { get; set; } public string BanReason { get; set; } = ""; }
record PickReq(int Choice);
class Sess { public string QuizId = "", Name = "", UserId = "", Ip = ""; public List<Question> Qs = new(); public int Limit; public int[] Order = Array.Empty<int>(); public int[][] Perm = Array.Empty<int[]>(); public int N, Pts, Ok; public DateTime? ServedAt; public bool Scare; public DateTime Started = DateTime.UtcNow; public string Mode = "classic"; public int Lives, Hints; public bool HintThis, Over; public int[]? Hidden; public DateTime Seen = DateTime.UtcNow; }

record Cell(int Points, string Question, string Answer);
record BoardCat(string Name, List<Cell> Cells);
record ImgRec(string Name, string UserId, DateTime At);
record PlayRec(string UserId, string QuizId, string Title, string Category, string Mode, int Points, int Correct, int Total, DateTime At);
record ReportReq(string? Reason);
record BanReq(string? Name, bool Banned, int Hours = 0, string? Reason = null);
record ClaimReq(string? Code);
record ModRec(string Admin, string Action, string Target, string Details, DateTime At);
record RoleReq(string? Name, string? Role);
class Report { public string Id { get; set; } = ""; public string QuizId { get; set; } = ""; public string UserId { get; set; } = ""; public string Reason { get; set; } = ""; public DateTime At { get; set; } public bool Open { get; set; } }
record NewBoard(string? Title, List<BoardCat>? Categories);

class Quiz
{
    public string Id { get; set; } = "";
    public string OwnerKey { get; set; } = "";
    public string OwnerUser { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Category { get; set; } = "Другое";
    public string Emoji { get; set; } = "🎯";
    public int TimeLimit { get; set; } = 20;
    public int Plays { get; set; }
    public DateTime Created { get; set; }
    public List<Question> Questions { get; set; } = new();
    public List<Score> Scores { get; set; } = new();
}

class Board
{
    public string Id { get; set; } = "";
    public string OwnerKey { get; set; } = "";
    public string OwnerUser { get; set; } = "";
    public string Title { get; set; } = "";
    public DateTime Created { get; set; }
    public List<BoardCat> Categories { get; set; } = new();
}

class Data
{
    public List<Quiz> Quizzes { get; set; } = new();
    public List<Board> Boards { get; set; } = new();
    public int SeedVer { get; set; }
    public List<User> Users { get; set; } = new();
    public List<Token> Tokens { get; set; } = new();
    public List<ImgRec> Images { get; set; } = new();
    public List<PlayRec> Plays { get; set; } = new();
    public List<Report> Reports { get; set; } = new();
    public List<ModRec> ModLog { get; set; } = new();
}

