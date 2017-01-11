
var ameriaApp = angular.module("ameriaApp", ['ngRoute', 'ui.bootstrap'])
.config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode({  // убираем #
        enabled: true,
        requiredBase: false
    });
    $routeProvider
        .when('/', { templateUrl: "/views/time.html" })
        // .when('/time', { templateUrl: "/views/time.html" })
        .when('/staff', { templateUrl: "/views/staff.html" })
        .when('/struct', { templateUrl: "/views/struct.html" })
        .otherwise({ redirectTo: '/' });
}])
.run(['$rootScope', '$templateCache', function($rootScope, $templateCache) {
    $rootScope.$on('$routeChangeStart', function(event, next, current) {
        if (typeof(current) !== 'undefined') $templateCache.remove(current.templateUrl);
    });
}])
.controller("ameriaCtrl", ['$scope', '$http', '$filter', '$location', '$uibModal', 'globalEdit', function ($scope, $http,  $filter, $location, $uibModal, globalEdit) {

    console.log('ameria works');
    // текущее представление
    $scope.currentView = 'time';
    $scope.order = {
        time: '-date',
        staff: 'name',
        struct: 'name',
        depends: 'name'
    };
    $scope.itemsToShow = {
        time: [],
        staff: [],
        struct: [],
        depends: []
    };
    $scope.totalItems = {
        time: 0,
        staff: 0,
        struct: 0,
        depends: 0
    };
    $scope.currentPage = {
        time: 1,
        staff: 1,
        struct: 1,
        depends: 1
    };
    $scope.limitValue = {
        time: 5,
        staff: 5,
        struct: 5,
        depends: 5
    };
    $scope.limitRange = [5, 10, 20];  // возможные варианты лимита
    modulUrl = {
        delete: {
            time: './views/deleteTime-dialog.html',
            staff: './views/deleteStaff-dialog.html',
            struct: './views/deleteStruct-dialog.html',
            depends: './views/deleteDep-dialog.html'
        },
        edit: {
            time: './views/editTime-dialog.html',
            staff: './views/editStaff-dialog.html',
            struct: './views/editStruct-dialog.html',
            depends: './views/editStruct-dialog.html'
        }
    };
    newdataTmpl = {
        time: {id: '', date: '', person_id: '',timeIn: '',timeOut: ''},
        staff: {id: '', person_id: '', name: '', sex: '', contact: '', date: ''},
        struct: {id: '', person_id: '', depends: ''},
        depends: {id: '', person_id: '', depends: ''}
    }

    $scope.refreshData = function () {
        $http.get('./data/base.json')
            .success(function(data){
                globalEdit.setLocalData('staff', data.staff);
                globalEdit.setLocalData('time', data.time);
                globalEdit.setLocalData('struct', data.struct);
                $scope.itemsToShow['staff'] = globalEdit.getShowItems('staff', $scope.currentPage['staff']);
                $scope.itemsToShow['time'] = globalEdit.getShowItems('time', $scope.currentPage['time']);
                $scope.itemsToShow['struct'] = globalEdit.getShowItems('struct', $scope.currentPage['struct']);
                $scope.changedLimit('time', $scope.limitValue['time']);
            });
    };
    $scope.refreshData();

    // у каждого сотрудника свой табельный номер.
    // Новому сотруднику - поиск наибольшего таб.номера +1

    $scope.today = $filter("date")(Date.now(), 'dd.MM.yyyy');
    console.log('date now-',Date.now());

    rebuildContent = function (state) {
        $scope.itemsToShow[state] = globalEdit.getShowItems(state, $scope.currentPage[state]);
    };

    $scope.changedLimit = function (state, newLimit) {
        if (newLimit) globalEdit.doItemPerPage(state, newLimit);
        // установить общее количество записей для пагинации
        $scope.totalItems[state] = globalEdit.getTotalItemsNum(state);
        // сколько записей на страницу
        if (state == 'depends') {
            $scope.iPerPageDep = globalEdit.doItemPerPage(state);
        } else {
            $scope.iPerPage = globalEdit.doItemPerPage(state);
        };
        // вернуть номер страницы текущего представления
        $scope.currentPage[state] = globalEdit.doCurrentPage(state);
        // получить записи текущей страницы
        rebuildContent(state);
    };

    $scope.changeOrder = function (state, order) {
        var currOrder = globalEdit.doOrder(state);
        if (currOrder === order) order = order.replace('-', '');
        globalEdit.doOrder(state, order);
        rebuildContent(state);
    };

    // вытянуть номер страницы, куда нажали в пагинации
    $scope.pageChange = function (state, page) {        // запомнить страницу
        globalEdit.doCurrentPage(state, page);
        // при смене страниц в Структуре - обнулять выбор подчинённых
        if (state == 'struct') {
            globalEdit.updShowDepends(); // очистить окно зависимостей
            $scope.selectPers = null;     // очистить выбор руководителя
            $scope.invalidDep = true;     // потушить кнопку Add
            $scope.totalItems['depends'] = globalEdit.getTotalItemsNum('depends');
            rebuildContent('depends');
        };
        rebuildContent(state);
    };

    // сменить представление контроль времени / персонал
    $scope.changeView = function (state) {
        $scope.currentView = state;
        // $location.path("/"+state);  // при смене вида менять Url
        $location.path(state);
        $scope.changedLimit(state);
    };

    saveNewOrChng = function (state, personEvent, newValue) {
        // если создание новых данных - получить новый id
        if (!personEvent) {
            newValue.id = globalEdit.getLocalLastObjNum(state, 'id');
            globalEdit.addLocalData(state, newValue);
        } else {
            globalEdit.updLocalData(state, newValue, 'id');
        }
    };

    // модальное окно
    $scope.deleteItem = function (state, row) {
        var uibModalInstance = $uibModal.open({
          templateUrl: modulUrl.delete[state],
          controller: 'deleteDialogCtrl',
          size: 'sm',
          resolve: {
            row: function () { return row; },
            state: function () { return state; }
          }
        });
        uibModalInstance.result.then(function (deleteType) {
          switch (deleteType) {
            case 'staff': //удаляем Персону, весь Журнал учета времени по ней и структуру
              globalEdit.deleteLocalItem(state, row, 'id');
              globalEdit.deleteLocalItem('time', row, 'person_id');    // удалить все записи в журнале времени
              globalEdit.deleteLocalItem('struct', row, 'person_id');  // удалить руководителя в структуре
              globalEdit.deleteLocalAllDep(row);                       // удалить подчиненного из всех зависимостей
              rebuildContent('depends');
              break;
            case 'thisTime': //удаляем текущую запись времени по персоне
              globalEdit.deleteLocalItem(state, row, 'id');
              break;
            case 'allTimeNotes': //удаляем все записи времени по персоне
              globalEdit.deleteLocalItem(state, row, 'person_id');
              break;
            case 'struct':
              globalEdit.deleteLocalItem(state, row, 'id');
              globalEdit.updShowDepends();                             // обнулить окно зависимостей
              // $scope.totalItems['depends'] = globalEdit.getTotalItemsNum('depends');
              rebuildContent('depends');
              break;
            case 'depends': // удалить зависимость персоны
              globalEdit.deleteLocalDep($scope.selectPers, row);
              globalEdit.updShowDepends($scope.selectPers);
              // перестроить текущее окно в Структуре с пересчетом количества записей
              $scope.changedLimit('depends');
              state = 'struct';
              break;
          };
          $scope.changedLimit(state, $scope.limitValue.state);
        });
    };

    $scope.editCreateItem = function (typeModul, row) {
        if (!typeModul) var typeModul = $scope.currentView;   // если создаём новый элемент

        // если выбрано изменение данных - сделать копию редактируемой записи
        // если создание новых данных - сделать пустой объект
        $scope.newdata = row ? angular.copy(row) : angular.copy(newdataTmpl[typeModul]);
        if (typeModul == 'depends') row = $scope.selectPers;

        var uibModalInstance = $uibModal.open({
          templateUrl: modulUrl.edit[typeModul],
          controller: 'editDialogCtrl',
          size: 'lg',
          resolve: {
            row: function () { return row; },
            newdata: function () { return $scope.newdata; },
            typeModul: function () { return typeModul; }
          }
        });

        uibModalInstance.result.then(function (newdata) {
          switch (typeModul) {
            case 'time': //редактировать запись в журнал учета времени
                saveNewOrChng(typeModul, row, newdata);
                break;
            case 'staff': //редиктировать экземпляр Персоны
                saveNewOrChng(typeModul, row, newdata);
                break;
            case 'struct': //редиктировать экземпляр struct
                newdata.name = globalEdit.getName(newdata.person_id); // для orderBy по имени
                saveNewOrChng(typeModul, row, newdata);
                break;
            case 'depends': //редиктировать экземпляр struct
                typeModul = 'struct';
                newdata.name = globalEdit.getName(newdata.person_id); // для orderBy по имени
                saveNewOrChng(typeModul, row, newdata);
                globalEdit.updShowDepends(newdata);
                // перестроить текущее окно в Структуре с пересчетом количества записей
                $scope.changedLimit('depends');
                break;
          };
          $scope.changedLimit(typeModul);
          row = '';
        });
    };
    // выделить цветом выбранного руководителя
    $scope.target;
    $scope.invalidDep = true;
    $scope.selectStructPers = function (row, event) {
        $scope.invalidDep = false;
        $scope.target = event.target;
        angular.element(event.target).addClass("bg-info");
        $scope.selectPers = row;
        globalEdit.updShowDepends(row);
        $scope.changedLimit('depends');
    };
    $scope.$watch("target", function (newVal, oldVal) {
        if(newVal !== oldVal && newVal) angular.element(oldVal).removeClass("bg-info");
    });

}]);

ameriaApp.controller('deleteDialogCtrl', ['$scope', '$uibModalInstance', 'row', function ($scope, $uibModalInstance, row) {
    $scope.clear = true;   // проверка на пустые поля
    $scope.$watch("deleteType", function (newVal, oldVal) {
        if(newVal !== oldVal && newVal) $scope.clear = false;
    });
    $scope.agree = false;  // по умолчанию согласия нет
    $scope.deleteName = row.name;
    $scope.ok = function (state) {
        if (angular.isDefined(state)) $scope.deleteType = state;
        $uibModalInstance.close($scope.deleteType);
    };
    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);

ameriaApp.controller('editDialogCtrl', ['$scope', '$filter', '$uibModalInstance', 'row', 'newdata', 'typeModul', 'globalEdit', function ($scope, $filter, $uibModalInstance, row, newdata, typeModul, globalEdit) {
  // если новая запись: newdata - объект с пустыми полями
  // если новая запись: row - undefined
    $scope.newdata = newdata;
    $scope.row = row ? row : 'row'; // нужно значение для исключения
    $scope.currentName = newdata.name;
    $scope.limitSex = ["man", "woman", "else"];
    // до введения данных скрыть кнопку Save
    checkFields = function () {
        var result = true;
        if (typeModul == 'time') result = ($scope.newdata.date && $scope.newdata.person_id) ? false : true;
        if (typeModul == 'staff') result = ($scope.newdata.date && $scope.newdata.name && $scope.newdata.sex) ? false : true;
        if (typeModul == 'struct') result = ($scope.newdata.person_id) ? false : true;
        if (typeModul == 'depends') result = ($scope.newdata.person_id) ? false : true;
        return result;
    };
    $scope.invalid = checkFields();
    $scope.$watch(checkFields, function (newValue) {
        $scope.invalid = checkFields();
    });

    $scope.ok = function () {
        var censoredData = {
            id: $scope.newdata.id,
            // если сотрудник новый - узнать новый табельный номер
            person_id: $scope.newdata.person_id ? $scope.newdata.person_id : globalEdit.getLocalLastObjNum('staff', 'person_id')
        };
        if (typeModul == 'time') {
            censoredData.date = $scope.newdata.date.valueOf();
            censoredData.timeIn = $filter("date")($scope.newdata.timeIn, 'HH:mm:ss');
            censoredData.timeOut = $filter("date")($scope.newdata.timeOut, 'HH:mm:ss');
        };
        if (typeModul == 'staff') {
            censoredData.name = $scope.newdata.name;
            censoredData.sex = $scope.newdata.sex;
            censoredData.contact = $scope.newdata.contact;
            censoredData.date = $scope.newdata.date.valueOf();
        };
        if (typeModul == 'struct') {
            censoredData.depends = $scope.newdata.depends;
        };
        if (typeModul == 'depends') {
            var currDeps = globalEdit.getLocalData('struct', $scope.row.person_id).depends;
            censoredData.id = $scope.row.id;
            censoredData.person_id = $scope.row.person_id;
            censoredData.depends = currDeps ? (currDeps+','+$scope.newdata.person_id) : (''+$scope.newdata.person_id);
        };

        $uibModalInstance.close(censoredData);
    };
    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);


// ------------------  Date picker directive  ------------

ameriaApp.directive('datePicker', ['$filter', function ($filter) {
    return {
        templateUrl: 'views/directives/datepicker.html',
        scope: {
            newdata: "=newdata"
        },
        link: function ($scope, element, attrs) {
            console.log('datePicker: newdata', $scope.newdata);
            $scope.today = function() {
                $scope.newdata.date = Date.now();
            };

            $scope.clear = function() {
                $scope.newdata.date = null;
            };

            $scope.inlineOptions = {
                minDate: new Date(),
                minDateStatus: 'Disabled',
                showWeeks: true
            };

            $scope.dateOptions = {
                minDate: new Date(),
                startingDay: 1
            };

            $scope.toggleMin = function() {
                $scope.inlineOptions.minDate = $scope.inlineOptions.minDate ? null : new Date();
                $scope.inlineOptions.minDateStatus = $scope.inlineOptions.minDate ? 'Enabled' : 'Disabled';
                $scope.dateOptions.minDate = $scope.inlineOptions.minDate;
            };

            $scope.toggleMin();

            $scope.open1 = function() {
                $scope.popup1.opened = true;
            };

            $scope.popup1 = {
                opened: false
            };
        }
    }
}]);

// выбор времени
ameriaApp.directive('timePicker',['$filter', 'globalEdit', function($filter, globalEdit) {
    return {
        templateUrl: 'views/directives/timepicker.html',
        scope: {
            newdata: "=newdata"
        },
        link: function ($scope, element, attrs) {
            var timetype = attrs.timetype;
            var startTime = $scope.newdata[timetype] ? $scope.newdata[timetype] : '00:00:00';
            var timeArr = startTime.split(':');

            $scope.timeRefresh = function () {
                var d = new Date();
                d.setHours( parseInt(timeArr[0]) );
                d.setMinutes( parseInt(timeArr[1]));
                d.setSeconds( parseInt(timeArr[2]));
                $scope.mytime = d;
            };
            $scope.timeRefresh();

            $scope.hstep = 1;
            $scope.mstep = 1;
            $scope.sstep = 1;

            $scope.changed = function () {
                $scope.newdata[timetype] = $filter("date")($scope.mytime, 'HH:mm:ss');;
            };

            $scope.update = function() {
                $scope.mytime = new Date();
                $scope.changed();
            };

            $scope.clear = function() {
                $scope.timeRefresh();
                $scope.changed();
            };
        }
    }
}]);

ameriaApp.directive('selectPerson',['$filter','globalEdit', function($filter, globalEdit) {
    return {
        templateUrl: 'views/directives/selectPerson.html',
        scope: {
            newdata: "=newdata"
        },
        link: function ($scope, element, attrs) {
            // если редактирование записи - селект не предлагать
            $scope.showSelect = $scope.newdata.name ? false : true;
            $scope.personChoose = '';
            // получить список сотрудников, отсортировать по возрастанию
            $scope.staff = $filter("orderBy")(globalEdit.getLocalData('staff'), 'name');
            if (attrs.exception) {  // если в Структуре
                $scope.showSelect = true;
                // ограничить выбор - без действующего руководства
                // если добавляем подчиненного - также без уже указанных
                $scope.staff = globalEdit.reduceSelectStaff(attrs.exception);
            };

            $scope.changed = function () {
                $scope.newdata.name = $scope.personChoose.name;
                $scope.newdata.person_id = $scope.personChoose.person_id;
            };

            $scope.clear = function() {
                $scope.personChoose = '';
                $scope.changed();
            };
        }
    }
}]);

ameriaApp.directive('editpersonName',['globalEdit', function (globalEdit) {
    return {
        templateUrl: 'views/editPersonName.html',
        scope: {
            newdata: "=newdata"
        },
        link: function ($scope, element, attrs) {
            var nameArr = $scope.newdata.name.split(' ');
            createArr = function () {
                $scope.current = {
                    surname: nameArr[0],
                    name: nameArr[1],
                    midname: nameArr[2]
                };
            };
            createArr();

            $scope.changed = function () {
                $scope.newdata.name = $scope.current.surname + ' ' + $scope.current.name + ' ' + $scope.current.midname;
            };
            $scope.cancel = function() {
                createArr();
                $scope.changed();
            };
        }
    }
}]);

ameriaApp.factory('globalEdit',['$filter', function ($filter) {
    var
        data = {
            time: [],
            staff: [],
            struct: [],
            depends: []
        },
        order = {
            time: '-date',
            staff: 'name',
            struct: 'name',
            depends: 'name'
        },
        iPerPage = {
            time: 5,
            staff: 5,
            struct: 5,
            depends: 5
        },
        currentPage = {
            time: 1,
            staff: 1,
            struct: 1,
            depends: 1
        };
    getDependsIdArr = function (currPerson) {
        // взять зависимости в виде строки, разбить в массив
        for (var i = 0; i < data.struct.length; i++) {
            if (data.struct[i].person_id === currPerson.person_id) {
                var arr = data.struct[i].depends.split(',');
                break;
            };
        };
        return arr;
    };
    getLocalPersonArr = function (person_idArr) {
        var dependsArr = [];
        // создать массив подчин-ных сотрудников
        person_idArr.forEach(function (item) {
            for (var i = 0; i < data.staff.length; i++) {
                if (data.staff[i].person_id == parseInt(item)) {
                    dependsArr.push(data.staff[i]);
                    break;
                };
            };
        });
        return dependsArr;
    };

    return {
        setLocalData: function (state, newData) {
            data[state] = newData;
            // console.log('recive data - ', data);
        },
        // при person_id - найти конкретную запись, иначе - выдать весь объем
        getLocalData: function (state, person_id) {
            if (angular.isUndefined(person_id)) return data[state];
            var i = data[state].length;
            while (i--) {
                if (data[state][i].person_id === person_id) return data[state][i];
            };
            return false;
        }, // state - где, newData - что менять, findType - по чём искать
        updLocalData: function (state, newData, findType) {
            console.log('updLocalData: recive at', state, 'data ', newData);
            var i = data[state].length;
            while (i--) {
                if (data[state][i][findType] === newData[findType]) {
                    data[state][i] = newData;
                    break;
                }
            };
        },
        addLocalData: function (state, newData) {
            console.log('addLocalData: push at', state, 'data ', newData);
            data[state].push(newData);
        },
        deleteLocalItem: function (state, item, findType) {
            // state - где, item - что удалять, findType - по чём искать
            for (var i = data[state].length-1 ; i >= 0 ; i--) {
                if (data[state][i][findType] === item[findType]) {
                    data[state].splice(i, 1);
                    if (findType == 'id') break;  // если удалять только конкретную запись
                }
            };
        },
        deleteLocalDep: function (currPerson, row) {
            // currPerson - обновляемый руководитель, row - удаляемый подчиненных
            var currDepsArr = getDependsIdArr(currPerson);
            // удалить из массива зависимостей
            for (var i = currDepsArr.length-1; i >= 0 ; i--)
                if (currDepsArr[i] == row.person_id) {
                    currDepsArr.splice(i, 1);
                    break;
                };
            currPerson.depends = currDepsArr.join();            // собрать строку
            this.updLocalData('struct', currPerson, 'person_id');
        },
        deleteLocalAllDep: function (row) {
            for (var i = data.struct.length-1; i >= 0 ; i--)
                this.deleteLocalDep(data.struct[i], row);
            this.updShowDepends();             // обновить список к выводу в окне
        },
        updShowDepends: function (currPerson) {        // обновить массив отображаемых подчинённых
            if ( angular.isUndefined(currPerson) ) {
                data.depends = [];
                return;
            };
            var idArr = getDependsIdArr(currPerson);   // получить массив person_id зависимых сотрудников
            data.depends = getLocalPersonArr(idArr);   // создать массив подчин-ных сотрудников
        },
        // определить список записей к выводу
        getShowItems: function (state, currNum) {    // num - номер страницы
            var num = angular.isUndefined(currNum) ? currentPage[state] : --currNum;
            var first = iPerPage[state] * num;
            var last = first + iPerPage[state];
            var showList = data[state];
            // добавить актуальные имена по табельным номерам
            for (var i = 0; i < showList.length; i++)
                showList[i].name = this.getName(showList[i].person_id);
            // order - по чём сортируем список
            showList = $filter("orderBy")(showList, order[state]).slice(first, last);
            return showList;
        },
        getName: function (person_id) {
            for (var i = 0; i < data.staff.length; i++) {
                if (data.staff[i].person_id == person_id) return data.staff[i].name;
            };
            return null;
        },
        getLocalLastObjNum: function (state, field) {
            var num = 1;
            for (var i = 0; i < data[state].length; i++) {
              if (data[state][i][field] >= num) num = data[state][i][field] + 1;
            };
            return num;
        },
        getTotalItemsNum: function (state) {
            return data[state].length;
        },
        doOrder: function (state, newOrder) {
            if (angular.isUndefined(newOrder)) return order[state];
            order[state] = newOrder;
            return false;
        },
        doItemPerPage: function (state, page) {
            if (angular.isUndefined(page)) return iPerPage[state];
            iPerPage[state] = page;
            return false;
        },
        doCurrentPage: function (state, page) {
            if (angular.isUndefined(page)) return currentPage[state];
            currentPage[state] = page;
            return 1;
        },
        reduceSelectStaff: function (head) {
            currSelect = $filter("orderBy")(data.staff, 'name');
            for (var j = data.struct.length - 1; j >= 0 ; j--) {      // все руководители
                for (var i = currSelect.length - 1; i >= 0; i--) {    // весь персонал
                    if (currSelect[i].person_id === data.struct[j].person_id) {
                        currSelect.splice(i, 1);       // найденного руководителя убрать из выдачи
                        break;
                    }
                }
            };
            if (head) for (var j = data.depends.length - 1; j >= 0 ; j--) {   // все подчиненные
                for (var i = currSelect.length - 1; i >= 0; i--) {    // весь персонал
                    if (currSelect[i].person_id === data.depends[j].person_id) {
                        currSelect.splice(i, 1);  // найденного подчин-го убрать из выдачи
                        break;
                    }
                }
            };
            return currSelect;
        }
    }
}]);
