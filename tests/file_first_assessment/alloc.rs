// Concrete allocation-request witness for the assessment integration binary.
// Counts allocation requests created inside one native call on this thread.
// Borrowed caller buffers and allocations predating the call are excluded.
use std::{
    alloc::{GlobalAlloc, Layout, System},
    cell::Cell,
};
thread_local! {
    static SERIAL:Cell<usize>=const {Cell::new(0)};
    static GENERATION:Cell<usize>=const {Cell::new(0)};
    static LIVE:Cell<usize>=const {Cell::new(0)};
    static PEAK:Cell<usize>=const {Cell::new(0)};
}
pub struct AssessmentAllocator;
fn expanded(layout: Layout) -> (Layout, usize) {
    let align = layout.align().max(std::mem::align_of::<usize>());
    let offset = std::mem::size_of::<usize>().div_ceil(align) * align;
    (
        Layout::from_size_align(layout.size() + offset, align).unwrap(),
        offset,
    )
}
// SAFETY: each allocation retains its generation header and the same expanded
// layout on deallocation. TLS observations neither allocate nor recurse.
unsafe impl GlobalAlloc for AssessmentAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let (full, offset) = expanded(layout);
        // SAFETY: full is a valid layout.
        let base = unsafe { System.alloc(full) };
        if base.is_null() {
            return base;
        }
        let generation = GENERATION.try_with(Cell::get).unwrap_or(0);
        // SAFETY: header belongs to this allocation, aligned and in bounds.
        unsafe {
            base.cast::<usize>().write(generation);
        }
        if generation != 0 {
            LIVE.with(|l| {
                l.set(l.get() + layout.size());
                PEAK.with(|p| p.set(p.get().max(l.get())));
            });
        }
        // SAFETY: offset leaves layout.size() bytes with required alignment.
        unsafe { base.add(offset) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        let (full, offset) = expanded(layout);
        // SAFETY: pointer/layout came from this allocator, header remains live.
        let base = unsafe { ptr.sub(offset) };
        // SAFETY: header is initialized and aligned.
        let generation = unsafe { base.cast::<usize>().read() };
        if generation != 0 && GENERATION.try_with(Cell::get).unwrap_or(0) == generation {
            LIVE.with(|l| l.set(l.get() - layout.size()));
        }
        // SAFETY: base/full are the original system allocation pair.
        unsafe { System.dealloc(base, full) };
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        // The conservative peak includes old and replacement requests while
        // reallocating, even when a system allocator could resize in place.
        let next = Layout::from_size_align(size, layout.align()).unwrap();
        // SAFETY: allocation uses a valid replacement layout.
        let new = unsafe { self.alloc(next) };
        if !new.is_null() {
            // SAFETY: disjoint allocations with these sizes remain live.
            unsafe {
                std::ptr::copy_nonoverlapping(ptr, new, layout.size().min(size));
                self.dealloc(ptr, layout);
            }
        }
        new
    }
}
pub fn begin() {
    SERIAL.with(|s| {
        s.set(s.get() + 1);
        GENERATION.with(|g| g.set(s.get()));
    });
    LIVE.with(|l| l.set(0));
    PEAK.with(|p| p.set(0));
}
pub fn finish() -> usize {
    let peak = PEAK.with(Cell::get);
    GENERATION.with(|g| g.set(0));
    peak
}
