"""WebSocket consumers for import progress updates."""
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.importer.models import ImportJob


@database_sync_to_async
def _user_owns_import_job(*, user_id: int, job_id: int) -> bool:
    return ImportJob.objects.filter(id=job_id, user_id=user_id).exists()


class ImportProgressConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time import progress updates."""

    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.job_id = int(self.scope["url_route"]["kwargs"]["job_id"])
        has_access = await _user_owns_import_job(user_id=user.id, job_id=self.job_id)
        if not has_access:
            await self.close(code=4403)
            return

        self.group_name = f"import_{self.job_id}"

        # Join job-specific group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave job group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def import_progress(self, event):
        """Handle import progress event from Celery task."""
        await self.send_json(
            {
                "type": "progress",
                "phase": event.get("phase", ""),
                "message": event.get("message", ""),
                "current": event.get("current", 0),
                "total": event.get("total", 0),
                "percent": event.get("percent", 0),
            }
        )

    async def import_complete(self, event):
        """Handle import completion event."""
        await self.send_json(
            {
                "type": "complete",
                "status": event.get("status", "success"),
                "message": event.get("message", "Import completed"),
                "result_set_id": event.get("result_set_id"),
            }
        )

    async def import_error(self, event):
        """Handle import error event."""
        await self.send_json(
            {
                "type": "error",
                "message": event.get("message", "Import failed"),
                "details": event.get("details", ""),
            }
        )
