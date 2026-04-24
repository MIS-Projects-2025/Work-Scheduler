<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShiftCode extends Model
{
    protected $table = 'shift_codes';

    protected $primaryKey = 'shift_code_id';

    public $timestamps = false;

    protected $fillable = [
        'shift_code_status',
        'shiftcode',
        'shiftcode_value',
        'shiftcode_desc',
        'shift_group',
        'shiftcode_bg_color',
        'shiftcode_font_color',
        'time_windows',
        'ot_hrs',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
    ];

    protected $casts = [
        'time_windows' => 'array',
    ];
}
