using Microsoft.AspNetCore.Mvc;
using SagreEventi.Shared.Models;
using SagreEventi.Web.Server.Models.Services.Application;

namespace SagreEventi.Web.Server.Controllers;

[ApiController]
[Route("api/[controller]/[action]")]

public class EventiController(ILogger<EventiController> logger, IEventiService eventiService) : ControllerBase
{
    private readonly ILogger<EventiController> logger = logger;
    private readonly IEventiService eventiService = eventiService;

    [HttpGet]
    public async Task<List<EventoModel>> GetEventiAsync([FromQuery] DateTime since)
    {
        return await eventiService.GetEventi(since);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateEventiAsync(List<EventoModel> eventi)
    {
        await eventiService.UpdateEventi(eventi);
        return Ok();
    }
}