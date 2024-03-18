  import React, { useEffect, useRef, useState } from 'react'
  import ReactDOM from 'react-dom/client'
  import { bitable, checkers, IAttachmentField, IOpenCellValue } from '@lark-base-open/js-sdk';
  import { Alert, AlertProps, Button } from 'antd';
  // 为这样的代码
  import ExcelJS, { Workbook } from 'exceljs';
  import saveAs from 'file-saver';


  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LoadApp/>
  </React.StrictMode>
  )

  // 定义属性的数据格式
  type PropertySheet = {
  name: string;
  identifier: string;
  desc?: string;
  accessMode?: string;
  type?:string;
  data?:string;
  };
  // 定义方法的数据格式
  type ActionSheet = {
  name: string;
  identifier: string;
  desc?: string;
  inputType?: string;
  inputData?:string;
  outputType?: string;
  outputData?:string;
  };
  // 定义事件的数据格式
  type EventSheet = {
  name: string;
  identifier: string;
  desc?: string;
  outputType?: string;
  outputData?:string;
  };


function LoadApp() {
  const [info, setInfo] = useState('get table name, please waiting ....');
  const [alertType, setAlertType] = useState<AlertProps['type']>('info');
  // 定义事件的数据数组
  const [CurrentViewName, setCurrentViewName] = useState<any | null>(null);
   // 在组件顶部定义状态
  const [CurrentTableView, setCurrentTableView] = useState();
  // 在组件顶部定义状态
  const [tableViews, setTableViews] = useState([]);
  // 获取当前的多维表格
  const table = bitable.base.getActiveTable();
  
  useEffect(() => {
    
    const fn = async () => {
      // 获取表格的名称
      const tableName = await (await table).getName();
      setInfo(`The table Name is ${tableName}`);
      setAlertType('success');

      // 从table中获取视图
      let ViewList = await (await table).getViewList();
      // 获取每个视图的名称，并构建包含视图和名称的对象数组
      const viewsWithName = await Promise.all(ViewList.map(async (view) => {
        const name = await view.getName();
        return { view, name };
      }));
      // 过滤掉名称为"表格"的视图
      const filteredViews = viewsWithName.filter(viewWithName => viewWithName.name !== "表格");
      setTableViews(filteredViews)

      // 获取视图的名称
      const CurrentView = await (await table).getActiveView();
      const viewName = (await CurrentView.getMeta()).name;
      setInfo(`The table Name is ${tableName} - ` + viewName);
      setCurrentViewName(viewName)
      setCurrentTableView(CurrentView)
      
      // 获取视图的记录
      const viewRecords = await (await table).getRecords({
        viewId: (await CurrentView.getMeta()).id,
      }) 

    };

    fn();

  }, []);

  // 假设 getRecordData 是一个异步函数，它返回一个 Promise
  const getRecordData = async (viewRecords, viewName) => {
    // 假设您要查找的字段名称
    const targetNames = ["功能名称", "标识符Identifier", "文本", "权限", "数据类型Type", "入参数据范围", "类型","Identifier的版本"];
    const targetKeys = ['name', 'identifier', "desc", "accessMode", "type", "data", "类型","idVersion"];
    //根据表格获取其中的每个字段
    const fields = await (await table).getFieldMetaList();
    //使用filter方法过滤出具有特定名称的记录
    const filteredFields= fields.filter(function (record) {
      return targetNames.includes(record.name);
    });

    // 得到视图的记录
    const records = viewRecords.records;

    // 数据处理,将表格中我需要的数据提取出来
    let propertys: any[] | ((prevState: PropertySheet[]) => PropertySheet[]) = []
    let actions: any[] | ((prevState: ActionSheet[]) => ActionSheet[]) = []
    let events: any[] | ((prevState: EventSheet[]) => EventSheet[]) = []

    // 解析数据
    records.forEach(async record => {
      // 新建json容器
      let json = {} as any;

      // 遍历filteredFields列表，提起cell的制定数据
      for (const field of filteredFields) {
        // 取到cell中指定field的数据
        const val = record.fields[field.id]
        let key = targetKeys[targetNames.indexOf(field.name)]
        
        // 对数据进行类型判断
        if(checkers.isSegments(val)){ //判断是不是文本
          json[key] = val.map((segment) => {
            return segment.text
          }).join("")
        }else if(checkers.isEmpty(val)){ //判断是不是空数据
          json[key] = "";
        }else if(checkers.isSingleSelect(val)){  //判断是不是单选
          json[key] = val.text;
        }else if(checkers.isMultiSelect(val)){   //判断是不是多选
          json[key] = val.map((segment) => {
            return segment.text
          }).join("")
        }else {            //其他的类型维持本身
          json[key] = val
        }
      }
      // 属性的数据放到一起，方便导出
      await JosnDataInit(propertys,actions,events,json,viewName)
    })

    // // 去重 & 设置数据 & 返回数据
    return {
      propertys: setArrayUnique(propertys),
      actions: setArrayUnique(actions),
      events: setArrayUnique(events)
    }; 
  }


  // 解析数据
  function JosnDataInit (propertys,actions,events,json,viewName){
    // 属性的数据放到一起，方便导出
        // console.log(json)
        if (json['类型'] === "属性") {
          // "Identifier的版本" 特殊处理 合并 identifier与idVersion
          if(json['idVersion'].length > 0){
            json['identifier'] = json['identifier'] + "__" + json['idVersion']
          }

          if(json['type'].length <= 0){
            json['inputType'] = 'string'
            console.error(viewName + " - 属性:" + json['identifier'] + "「数据类型Type」字段未进行填写,默认写了‘string’")
          }

          if(json['data'].length <= 0){
            json['data'] = ''
            console.error(viewName + " - 属性:" + json['identifier'] + "「入参数据范围」字段未进行填写,默认写空")
          }

          // 定义一个数组来指定键的顺序
          var propertyKeyOrder = ['name', 'identifier', "desc", "accessMode", "type", "data"];
          // 创建一个新的对象，按照指定的顺序来存储键值对
          var orderedJsonObj = {} as any;
          propertyKeyOrder.forEach(function(key) {
              if (json.hasOwnProperty(key)) {
                  orderedJsonObj[key] = json[key];
              }
          });
          json = orderedJsonObj;
          

          propertys.push(json as PropertySheet);
        } else if (json['类型'] === "方法") {

          if(json['type'].length > 0){
            json['inputType'] = json['type']
          }else{
            json['inputType'] = 'string'
            console.warn(viewName + " - 方法:" + json['identifier'] + "「数据类型Type」字段未进行填写,默认写了‘string’")
            
          }

          if(json['data'].length > 0){
            json['inputData'] = json['data']
          }else{
            json['inputData'] = ''
            console.warn(viewName + " - 方法:" + json['identifier'] + "「入参数据范围」字段未进行填写,默认写空")
          }

          if(json['identifier'].length > 0){
            json['outputType'] = 'string'
          }
          
          if(json['identifier'].length > 0){
            json['outputData'] = ''
          }


          // 定义一个数组来指定键的顺序
          var actionKeyOrder = ['name', 'identifier', "desc", "inputType", "inputData", "outputType","outputData"];
          // 创建一个新的对象，按照指定的顺序来存储键值对
          var orderedJsonObj = {} as any;
          actionKeyOrder.forEach(function(key) {
              if (json.hasOwnProperty(key)) {
                  orderedJsonObj[key] = json[key];
              }
          });
          json = orderedJsonObj;

          actions.push(json as ActionSheet);
        } else if (json['类型'] === "事件") {

          if(json['type'].length > 0){
            json['outputType'] = json['type']
          }else{
            json['outputType'] = 'string'
            // console.error(json['identifier'] + "「数据类型Type」字段未进行填写")
            console.warn(viewName + " - 事件:" + json['identifier'] + "「数据类型Type」字段未进行填写,默认写了‘string’")
          }

          if(json['data'].length > 0){
            json['outputData'] = json['data']
          }else{
            json['outputData'] = ''
          }

            // 定义一个数组来指定键的顺序
            var actionKeyOrder = ['name', 'identifier', "desc","outputType","outputData"];
            // 创建一个新的对象，按照指定的顺序来存储键值对
            var orderedJsonObj = {} as any;
            actionKeyOrder.forEach(function(key) {
                if (json.hasOwnProperty(key)) {
                    orderedJsonObj[key] = json[key];
                }
            });
            json = orderedJsonObj;

          events.push(json as EventSheet);
        }
  }

  // 修改 setArrayUnique 函数，使其直接返回去重后的数组
  function setArrayUnique(array) {
    let uniqueArray = array.reduce((accumulator, current) => {
      if (!accumulator.some(item => item.identifier === current.identifier)) {
          accumulator.push(current);
      }
      return accumulator;
    }, []);
    return uniqueArray;
  }

  // 添加sheet的方法
  function addSheet(jsons,sheetName,workbook){
    // 添加一个工作表 - property
    const worksheet = workbook.addWorksheet(sheetName);

    // 假设 jsonData 是一个对象数组，每个对象的键是列标题
    // 你可能需要根据你的数据结构进行调整
    if (jsons.length > 0) {
      // 添加列标题
      worksheet.columns = Object.keys(jsons[0]).map(key => ({
        header: key,
        key: key,
      }));

      // 添加数据行
      jsons.forEach((row) => {
        worksheet.addRow(row);
      });
    }
  }

  // 定义点击事件处理函数
  const handleClick = async (tableView) => {
    console.log(`按钮 ${tableView.name} 被点击了!`);

    // 获取视图的名称
    const viewName = tableView.name;
    setInfo(`Download the table is ${tableView.name}`);

    // 获取视图的记录
    const viewRecords = await (await table).getRecords({
      viewId: tableView.view.id
    }) 

    // 使用 getRecordData 返回的数据
    const { propertys, actions, events } = await getRecordData(viewRecords, viewName);

    // 创建一个新的工作簿
    const workbook = new ExcelJS.Workbook();
    addSheet(propertys,'property',workbook)
    addSheet(actions,'action',workbook)
    addSheet(events,'event',workbook)
    console.log(propertys)
    console.log(actions)
    console.log(events)
    // 将工作簿数据写入 buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // 创建一个 Blob 对象
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // 使用 FileSaver 库的 saveAs 函数来保存文件
    saveAs(blob, `${tableView.name}.xlsx`);
    
    // 假设你已经有了一个 Blob 对象，例如从上面的代码中获取的 blob
    const fileBlob = blob; // 这里应该是你实际的 Blob 对象
    const fileName = 'T8213.xlsx'; // 文件名

    // 调用上传文件的函数
    // uploadFile(fileBlob, fileName);

  };


  // 定义上传文件的函数
async function uploadFile(fileBlob, fileName) {
  // 创建 FormData 对象并添加文件
  const formData = new FormData();
  formData.append('file', fileBlob, fileName);

  // 定义 payload
  const payload = {
    file_name: fileName,
    is_cdn: true,
    type: 22
  };

  // 将 payload 转换为 JSON 字符串并添加到 FormData 中
  formData.append('payload', JSON.stringify(payload));

  // 发送 POST 请求上传文件
  try {
    const response = await fetch('https://mega-us-qa.eufylife.com/admin/upload_rom_file', {
      method: 'POST', // 或者 'OPTIONS'，如果服务器确实需要
      body: formData
    });

    // 检查响应状态
    if (response.ok) {
      const result = await response.json();
      console.log('文件上传成功:', result);
    } else {
      console.error('文件上传失败:', response.statusText);
    }
  } catch (error) {
    console.error('上传过程中出现错误:', error);
  }
}



  return (
    <div>
      <Alert message={info} type={alertType} />
      
      {tableViews.map((tableView, index) => (
        <button key={index} onClick={() => handleClick(tableView)}>
          点击下载指定表格： {tableView.name}
        </button>
      ))}
    </div>
  );
  }