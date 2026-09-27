package databases

// Postgres switches WAL segments at 16MB, a smaller cap drops slots on routine lag
const MinSlotWalKeepSizeMB = 64

// A lagging logical slot holds WAL on the data volume, so its cap follows the volume
func AutoSlotWalKeepSizeMB(volumeMiB int64) int64 {
	return max(volumeMiB/4, MinSlotWalKeepSizeMB)
}

// Data and max_wal_size share the volume, above half of it the cap stops protecting the disk
func MaxSlotWalKeepSizeMB(volumeMiB int64) int64 {
	return max(volumeMiB/2, MinSlotWalKeepSizeMB)
}
