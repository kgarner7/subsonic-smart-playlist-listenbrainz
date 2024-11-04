from multiprocessing.sharedctypes import SynchronizedArray
from multiprocessing import Array, Queue, Process
from queue import Empty

from .database import ProcessLocalSubsonicDatabase, ScanState


class MetadataProcess(Process):
    def __init__(self) -> None:
        self.request_event: "Queue" = Queue(maxsize=1)
        self.state: "SynchronizedArray[int]" = Array(
            "L", [0, 0, 0, 0, ScanState.IDLE.value]
        )
        """
        Process-safe progress tracker. Has the following meanings:
        - [0]: Fetched subsonic tracks
        - [1]: Metadata lookup progress
        - [2]: Metadata lookup total
        - [3]: Popularity lookup progress. Note that this count (if specified) is also metadata lookup count
        - [4]: Mode
        """

        super().__init__(daemon=True)

    def run(self) -> None:
        subsonic_db = ProcessLocalSubsonicDatabase(self.state)
        subsonic_db.open()
        subsonic_db.create()

        while True:
            is_full = self.request_event.get(True)
            with self.state.get_lock():
                self.state[4] = ScanState.SUBSONIC.value

                # In the extremely rare chance that we get a value from the queue
                # switch processes, and another process then immediately requests the queue again
                # we make sure to empty it. Since it is of max size one, this
                # operation is acceptable. Ignore the exception
                # This allows us to use self.state.get_lock()
                try:
                    self.request_event.get(False)
                except Empty:
                    pass
            try:
                subsonic_db.run_sync(is_full)
            except BaseException as e:
                with self.state.get_lock():
                    self.state[4] = ScanState.DONE.value
                print("Scan failed to complete", e)
                raise e
