<?php
// PHP-порт единого движка shared/remontforma-pricing.js.
// Ставки намеренно совпадают с текущим РЕМОНТФОРМА Calculator API.

function rf_n($v): float {
    $n = is_numeric($v) ? (float)$v : (float)str_replace(',', '.', (string)$v);
    return max(0, $n);
}
function rf_tile_rate(float $a, array $r): float {
    if ($a < 4) return $r['under4'];
    if ($a < 10) return $r['from4'];
    if ($a < 20) return $r['from10'];
    if ($a < 40) return $r['from20'];
    return $r['from40'];
}
function rf_clean_electrical_rate(float $a, array $r): float {
    if ($a < 40) return $r['under40'];
    if ($a <= 80) return $r['from40to80'];
    if ($a <= 150) return $r['from80to150'];
    return $r['over150'];
}
function rf_trash_rate(float $a, array $r): float {
    return $a <= 150 ? $r['upTo150'] : $r['over150'];
}

function remontforma_calculate(array $input = []): array {
    $rates = [
        'electrical'=>['partial'=>2500,'full'=>3500],
        'plumbing'=>['partial'=>1000,'full'=>2500],
        'bathroom'=>50000,
        'tile'=>['fixed'=>10000,'under4'=>10000,'from4'=>8000,'from10'=>4000,'from20'=>3000,'from40'=>2500],
        'laminate'=>1000,
        'plasticPlinth'=>400,
        'polyurethanePlinth'=>1300,
        'walls'=>['wallpaper'=>1500,'paint'=>4000,'decorative'=>2500],
        'cleanElectrical'=>['under40'=>1000,'from40to80'=>700,'from80to150'=>600,'over150'=>500],
        'cleanPlumbing'=>6000,
        'cleaning'=>400,
        'trash'=>['upTo150'=>1000,'over150'=>800],
    ];

    $floor=rf_n($input['floor']??0);
    $bath=rf_n($input['bath']??0);
    $balcony=rf_n($input['balcony']??0);
    $main=max(0,$floor-$bath-$balcony);
    $wallsArea=$main*2.8;
    $rows=[];

    $add=function($name,$cost,$quantity,$unit='м²',$price=0) use (&$rows) {
        if ($cost > 0) {
            $rows[]=[
                'name'=>(string)$name,
                'quantity'=>round($quantity*100)/100,
                'unit'=>(string)$unit,
                'price'=>round($price*100)/100,
                'cost'=>(int)round($cost)
            ];
        }
    };

    $electrical=$input['electrical']??'none';
    if ($electrical==='partial') $add('Электрика — частичная замена',$floor*$rates['electrical']['partial'],$floor,'м²',$rates['electrical']['partial']);
    if ($electrical==='full') $add('Электрика — полная замена',$floor*$rates['electrical']['full'],$floor,'м²',$rates['electrical']['full']);
    if ($electrical==='manual') {
        $p=rf_n($input['electricalRate']??0);
        $add('Электрика — ручная цена',$floor*$p,$floor,'м²',$p);
    }

    $plumbing=$input['plumbing']??'none';
    if ($plumbing==='partial') $add('Сантехника — частичная замена',$floor*$rates['plumbing']['partial'],$floor,'м²',$rates['plumbing']['partial']);
    if ($plumbing==='full') $add('Сантехника — полная замена',$floor*$rates['plumbing']['full'],$floor,'м²',$rates['plumbing']['full']);
    if ($plumbing==='manual') {
        $p=rf_n($input['plumbingRate']??0);
        $add('Сантехника — ручная цена',$floor*$p,$floor,'м²',$p);
    }

    $bathroom=$input['bathroom']??'none';
    if ($bathroom==='classic') $add('Классический санузел',$bath*$rates['bathroom'],$bath,'м²',$rates['bathroom']);
    if ($bathroom==='manual') {
        $q=rf_n($input['bathroomArea']??0);
        $add('Санузел — ручная площадь',$q*$rates['bathroom'],$q,'м²',$rates['bathroom']);
    }

    $tileArea=0;
    if (($input['tile']??'none')==='fixed') {
        $tileArea=$main;
        $add('Плитка',$main*$rates['tile']['fixed'],$main,'м²',$rates['tile']['fixed']);
    }
    if (($input['tile']??'none')==='manual') {
        $tileArea=min($main,rf_n($input['tileArea']??0));
        $p=rf_tile_rate($tileArea,$rates['tile']);
        $add('Плитка — ручная площадь',$tileArea*$p,$tileArea,'м²',$p);
    }
    if (!empty($input['laminate'])) {
        $q=max(0,$main-$tileArea);
        $add('Ламинат / кварцвинил',$q*$rates['laminate'],$q,'м²',$rates['laminate']);
    }

    if (($input['plinth']??'none')==='plastic') {
        $q=rf_n($input['plasticQty']??0) ?: $main;
        $add('Плинтус пластиковый',$q*$rates['plasticPlinth'],$q,'м²',$rates['plasticPlinth']);
    }
    if (($input['plinth']??'none')==='polyurethane') {
        $q=rf_n($input['polyQty']??0) ?: $main;
        $add('Плинтус полиуретановый',$q*$rates['polyurethanePlinth'],$q,'м²',$rates['polyurethanePlinth']);
    }

    $wallItems=[];
    $walls=$input['walls']??[];
    if (!empty($walls['wallpaper'])) $wallItems[]=['wallpaper','Подготовка под обои + обои',$rates['walls']['wallpaper']];
    if (!empty($walls['paint'])) $wallItems[]=['paint','Подготовка под покраску + покраска',$rates['walls']['paint']];
    if (!empty($walls['decorative'])) $wallItems[]=['decorative','Подготовка под декоративку + декоративка',$rates['walls']['decorative']];

    $manualWall=0;
    foreach ($wallItems as [$k,$name,$p]) $manualWall += rf_n(($walls[$k]['area']??0));
    $autoWall=array_filter($wallItems,fn($x)=>rf_n(($walls[$x[0]]['area']??0))<=0);
    $remain=max(0,$wallsArea-$manualWall);
    foreach ($wallItems as [$k,$name,$p]) {
        $q=rf_n(($walls[$k]['area']??0));
        if ($q<=0 && count($autoWall)>0) $q=$remain/count($autoWall);
        $add($name,$q*$p,$q,'м²',$p);
    }

    if (!empty($input['cleanElectrical'])) {
        $p=rf_clean_electrical_rate($floor,$rates['cleanElectrical']);
        $add('Чистовая электрика',$floor*$p,$floor,'м²',$p);
    }
    if (!empty($input['cleanPlumbing'])) $add('Чистовая сантехника',$bath*$rates['cleanPlumbing'],$bath,'м² санузла',$rates['cleanPlumbing']);
    if (!empty($input['cleaning'])) $add('Клининг',$floor*$rates['cleaning'],$floor,'м²',$rates['cleaning']);
    if (!empty($input['trash'])) {
        $p=rf_trash_rate($floor,$rates['trash']);
        $add('Вывоз мусора',$floor*$p,$floor,'м²',$p);
    }

    if (!empty($input['customWorks']) && is_array($input['customWorks'])) {
        foreach ($input['customWorks'] as $w) {
            $q=rf_n($w['quantity']??0);
            $p=rf_n($w['price']??0);
            $add((string)($w['name']??'Работа'),$q*$p,$q,(string)($w['unit']??'м²'),$p);
        }
    }

    $subtotal=array_reduce($rows,fn($s,$x)=>$s+$x['cost'],0);
    $markup=rf_n($input['markup']??0);
    $markupSum=(int)round($subtotal*$markup/100);
    $total=$subtotal+$markupSum;

    return [
        'floor'=>$floor,'bath'=>$bath,'balcony'=>$balcony,
        'mainArea'=>$main,'wallsArea'=>round($wallsArea*100)/100,
        'rows'=>$rows,'subtotal'=>$subtotal,'markup'=>$markup,
        'markupSum'=>$markupSum,'total'=>$total,
        'pricePerM2'=>$floor ? round(($total/$floor)*100)/100 : 0
    ];
}
