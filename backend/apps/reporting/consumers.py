"""WebSocket consumers for report job progress updates."""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.exporter.models import ExportJob


@database_sync_to_async
def _user_owns_report_job(*, user_id: int, job_id: int) -> bool:
    return ExportJob.objects.filter(
        id=job_id,
        user_id=user_id,
        export_format="pdf",
    ).exists()


class ReportProgressConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time report progress updates."""

    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.job_id = int(self.scope["url_route"]["kwargs"]["job_id"])
        has_access = await _user_owns_report_job(user_id=user.id, job_id=self.job_id)
        if not has_access:
            await self.close(code=4403)
            return

        self.group_name = f"report_{self.job_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def report_progress(self, event):
        await self.send_json(
            {
                "type": "progress",
                "message": event.get("message", ""),
                "current": event.get("current", 0),
                "total": event.get("total", 0),
                "percent": event.get("percent", 0),
            }
        )

    async def report_complete(self, event):
        await self.send_json(
            {
                "type": "complete",
                "status": event.get("status", "success"),
                "message": event.get("message", "Report completed"),
            }
        )

    async def report_error(self, event):
        await self.send_json(
            {
                "type": "error",
                "message": event.get("message", "Report failed"),
                "details": event.get("details", ""),
            }
        )
