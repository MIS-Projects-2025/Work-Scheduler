<?php

namespace App\Models;

use App\Traits\Loggable;
use Illuminate\Database\Eloquent\Model;

class RemarksHistory extends Model
{
    use Loggable;

    protected $table = 'remarks_history';
    protected $primaryKey = 'history_id';
    public $timestamps = false;

    protected $fillable = [
        'work_sched_id',
        'emp_id',
        'empname',
        'old_remarks',
        'new_remarks',
        'operation',
        'updated_at',
        'updated_by',
    ];


    public function workSchedule()
    {
        return $this->belongsTo(WorkSchedule::class, 'work_sched_id', 'id');
    }
}
