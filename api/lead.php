<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo json_encode(['ok'=>true,'service'=>'РЕМОНТФОРМА Lead API','version'=>'1.0.0'], JSON_UNESCAPED_UNICODE);
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false,'error'=>'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}
$raw=file_get_contents('php://input');
if (strlen($raw) > 120000) {
  http_response_code(413);
  echo json_encode(['ok'=>false,'error'=>'Payload too large'], JSON_UNESCAPED_UNICODE);
  exit;
}
$data=json_decode($raw,true);
if (!is_array($data)) $data=$_POST;
if (!empty($data['website'])) {
  echo json_encode(['ok'=>true,'message'=>'Заявка принята'], JSON_UNESCAPED_UNICODE);
  exit;
}
$phone=trim((string)($data['phone'] ?? ''));
if ($phone==='' || strlen($phone) > 40) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'phone is required'], JSON_UNESCAPED_UNICODE);
  exit;
}
$dir=dirname(__DIR__).'/data';
$file=$dir.'/leads.json';
if (!is_dir($dir)) @mkdir($dir,0755,true);
$lead=[
  'created_at'=>date('c'),
  'name'=>(string)($data['name']??''),
  'phone'=>$phone,
  'comment'=>(string)($data['comment']??''),
  'source'=>(string)($data['source']??'website'),
  'medium'=>(string)($data['medium']??''),
  'campaign'=>(string)($data['campaign']??''),
  'referrer'=>(string)($data['referrer']??''),
  'object'=>$data['object']??null,
  'calculator'=>$data['calculator']??null,
  'selection'=>$data['selection']??null,
  'files'=>$data['files']??[]
];
$list=[];
if (is_file($file)) {
  $old=json_decode((string)file_get_contents($file),true);
  if (is_array($old)) $list=$old;
}
$list[]=$lead;
if (count($list) > 5000) $list=array_slice($list,-5000);
file_put_contents($file,json_encode($list,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT),LOCK_EX);
echo json_encode(['ok'=>true,'message'=>'Заявка принята'],JSON_UNESCAPED_UNICODE);
