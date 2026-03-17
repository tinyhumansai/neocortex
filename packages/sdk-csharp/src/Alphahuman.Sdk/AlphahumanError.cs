namespace Alphahuman.Sdk;

public class AlphahumanError : Exception
{
    public int Status { get; }
    public string Body { get; }

    public AlphahumanError(string message, int status, string body)
        : base(message)
    {
        Status = status;
        Body = body;
    }
}
